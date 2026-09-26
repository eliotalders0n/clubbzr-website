import { Timestamp, arrayRemove, arrayUnion, deleteField } from 'firebase/firestore';

import { createDocumentWithId, updateDocument } from './firestore';
import type {
  CreateDocument,
  Session,
  SessionAccessMode,
  SessionApprovalMode,
  SessionPaymentMode,
  SessionPaymentProvider,
  SessionRegistration,
  SessionRegistrationPaymentStatus,
  SessionRegistrationStatus,
  UpdateDocument,
  User,
} from './schema';

export interface NormalizedSessionRegistrationConfig {
  accessMode: SessionAccessMode;
  paymentMode: SessionPaymentMode;
  paymentProvider: SessionPaymentProvider;
  approvalMode: SessionApprovalMode;
  isPaid: boolean;
}

export interface RegistrationCounts {
  confirmed: number;
  waitlisted: number;
  active: number;
}

export const ACTIVE_REGISTRATION_STATUSES: SessionRegistrationStatus[] = [
  'requested',
  'pending_payment',
  'paid_pending_confirmation',
  'confirmed',
  'waitlisted',
];

export const DEFAULT_MAX_TICKETS_PER_REGISTRATION = 10;

const toTicketCount = (value: unknown): number => {
  const count = Math.floor(Number(value));
  return Number.isFinite(count) && count >= 1 ? count : 1;
};

export const getMaxTicketsPerRegistration = (
  session: Pick<Session, 'maxTicketsPerRegistration'>
): number =>
  typeof session.maxTicketsPerRegistration === 'number'
    ? toTicketCount(session.maxTicketsPerRegistration)
    : DEFAULT_MAX_TICKETS_PER_REGISTRATION;

export const getRegistrationTicketQuantity = (
  registration?: Pick<SessionRegistration, 'ticketQuantity'> | null
): number => toTicketCount(registration?.ticketQuantity);

/** Seats taken by confirmed attendees, counting every ticket each attendee holds. */
export const getSessionSeatCount = (
  session: Pick<Session, 'attendees' | 'attendeeTickets'>
): number =>
  (session.attendees || []).reduce(
    (total, userId) => total + toTicketCount(session.attendeeTickets?.[userId]),
    0
  );

export const getSessionTicketTotal = (
  session: Pick<Session, 'price'>,
  ticketQuantity: number
): number => Math.round(Number(session.price || 0) * toTicketCount(ticketQuantity) * 100) / 100;

/** Session patch that adds a confirmed attendee along with their ticket count. */
export const buildAddAttendeePatch = (userId: string, ticketQuantity: number) =>
  ({
    attendees: arrayUnion(userId),
    waitlist: arrayRemove(userId),
    [`attendeeTickets.${userId}`]: toTicketCount(ticketQuantity),
  }) as unknown as UpdateDocument<Session>;

/** Session patch that removes an attendee (and optionally their waitlist entry) and their tickets. */
export const buildRemoveAttendeePatch = (userId: string, { waitlist = false } = {}) =>
  ({
    attendees: arrayRemove(userId),
    ...(waitlist ? { waitlist: arrayRemove(userId) } : {}),
    [`attendeeTickets.${userId}`]: deleteField(),
  }) as unknown as UpdateDocument<Session>;

export const getSessionRegistrationId = (sessionId: string, userId: string): string =>
  `${sessionId}__${userId}`;

export const normalizeSessionRegistrationConfig = (
  session: Pick<
    Session,
    | 'accessMode'
    | 'paymentMode'
    | 'paymentProvider'
    | 'approvalMode'
    | 'isFree'
    | 'price'
  >
): NormalizedSessionRegistrationConfig => {
  const isPaid = session.paymentMode
    ? session.paymentMode === 'paid'
    : Boolean(session.isFree === false || (session.price && session.price > 0));
  const paymentMode: SessionPaymentMode = isPaid ? 'paid' : 'free';
  const accessMode: SessionAccessMode = session.accessMode || 'open';
  const paymentProvider: SessionPaymentProvider = isPaid
    ? session.paymentProvider || 'manual_external'
    : 'none';
  const approvalMode: SessionApprovalMode = session.approvalMode || (isPaid || accessMode === 'invite_only' ? 'manual' : 'auto');

  return {
    accessMode,
    paymentMode,
    paymentProvider,
    approvalMode,
    isPaid,
  };
};

export const getRegistrationCounts = (
  registrations: Pick<SessionRegistration, 'status' | 'ticketQuantity'>[]
): RegistrationCounts => {
  return registrations.reduce<RegistrationCounts>(
    (counts, registration) => {
      const tickets = getRegistrationTicketQuantity(registration);

      if (registration.status === 'confirmed') {
        counts.confirmed += tickets;
      }

      if (registration.status === 'waitlisted') {
        counts.waitlisted += tickets;
      }

      if (ACTIVE_REGISTRATION_STATUSES.includes(registration.status)) {
        counts.active += tickets;
      }

      return counts;
    },
    { confirmed: 0, waitlisted: 0, active: 0 }
  );
};

export const getAvailableSessionSlots = (
  session: Pick<Session, 'capacity'>,
  registrations: Pick<SessionRegistration, 'status' | 'ticketQuantity'>[]
): number => Math.max((session.capacity || 0) - getRegistrationCounts(registrations).confirmed, 0);

export const getUserWhatsAppPhone = (
  user?: Pick<User, 'phone' | 'whatsappPhone'> | null
): string => {
  const whatsappPhone = user?.whatsappPhone?.trim();
  if (whatsappPhone) return whatsappPhone;

  return user?.phone?.trim() || '';
};

export const hasUserWhatsAppPhone = (
  user?: Pick<User, 'phone' | 'whatsappPhone'> | null
): boolean => Boolean(getUserWhatsAppPhone(user));

export const getInitialRegistrationState = (
  session: Session,
  confirmedCount: number,
  ticketQuantity = 1
): {
  status: SessionRegistrationStatus;
  paymentStatus: SessionRegistrationPaymentStatus;
} => {
  const config = normalizeSessionRegistrationConfig(session);
  const hasCapacity = (session.capacity || 0) >= confirmedCount + toTicketCount(ticketQuantity);

  if (!hasCapacity) {
    return {
      status: 'waitlisted',
      paymentStatus: config.isPaid ? 'unpaid' : 'not_required',
    };
  }

  if (config.paymentMode === 'paid') {
    return {
      status: 'pending_payment',
      paymentStatus: 'unpaid',
    };
  }

  if (config.approvalMode === 'manual' || config.accessMode === 'invite_only') {
    return {
      status: 'requested',
      paymentStatus: 'not_required',
    };
  }

  return {
    status: 'confirmed',
    paymentStatus: 'not_required',
  };
};

export const buildSessionRegistrationPayload = (
  session: Session,
  user: User,
  confirmedCount: number,
  ticketQuantity = 1
): CreateDocument<SessionRegistration> => {
  const tickets = toTicketCount(ticketQuantity);
  const initialState = getInitialRegistrationState(session, confirmedCount, tickets);
  const whatsappPhone = getUserWhatsAppPhone(user);

  return {
    sessionId: session.id,
    userId: user.uid || user.id,
    displayName: user.displayName || 'Club BZR member',
    email: user.email || '',
    ...(whatsappPhone ? { phone: user.phone?.trim() || whatsappPhone } : {}),
    ...(whatsappPhone ? { whatsappPhone } : {}),
    photoURL: user.photoURL || null,
    ticketQuantity: tickets,
    status: initialState.status,
    paymentStatus: initialState.paymentStatus,
    requestedAt: Timestamp.now(),
    ...(typeof session.price === 'number' ? { paymentAmount: getSessionTicketTotal(session, tickets) } : {}),
    paymentCurrency: session.currency || 'ZMW',
  };
};

export const createSessionRegistration = async (
  session: Session,
  user: User,
  confirmedCount: number,
  ticketQuantity = 1
) => {
  if (!hasUserWhatsAppPhone(user)) {
    return {
      success: false,
      error: {
        code: 'profile/whatsapp-required',
        message: 'Add your WhatsApp number to your profile before registering for sessions.',
      },
    };
  }

  const userId = user.uid || user.id;
  return createDocumentWithId(
    'sessionRegistrations',
    getSessionRegistrationId(session.id, userId),
    buildSessionRegistrationPayload(session, user, confirmedCount, ticketQuantity)
  );
};

export const updateSessionRegistration = (
  registrationId: string,
  data: UpdateDocument<SessionRegistration>
) => updateDocument('sessionRegistrations', registrationId, data);
