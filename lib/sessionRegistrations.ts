import { Timestamp } from 'firebase/firestore';

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
  registrations: Pick<SessionRegistration, 'status'>[]
): RegistrationCounts => {
  return registrations.reduce<RegistrationCounts>(
    (counts, registration) => {
      if (registration.status === 'confirmed') {
        counts.confirmed += 1;
      }

      if (registration.status === 'waitlisted') {
        counts.waitlisted += 1;
      }

      if (ACTIVE_REGISTRATION_STATUSES.includes(registration.status)) {
        counts.active += 1;
      }

      return counts;
    },
    { confirmed: 0, waitlisted: 0, active: 0 }
  );
};

export const getAvailableSessionSlots = (
  session: Pick<Session, 'capacity'>,
  registrations: Pick<SessionRegistration, 'status'>[]
): number => Math.max((session.capacity || 0) - getRegistrationCounts(registrations).confirmed, 0);

export const getInitialRegistrationState = (
  session: Session,
  confirmedCount: number
): {
  status: SessionRegistrationStatus;
  paymentStatus: SessionRegistrationPaymentStatus;
} => {
  const config = normalizeSessionRegistrationConfig(session);
  const hasCapacity = (session.capacity || 0) > confirmedCount;

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
  confirmedCount: number
): CreateDocument<SessionRegistration> => {
  const initialState = getInitialRegistrationState(session, confirmedCount);

  return {
    sessionId: session.id,
    userId: user.uid || user.id,
    displayName: user.displayName || 'Club BZR member',
    email: user.email || '',
    ...(user.phone ? { phone: user.phone } : {}),
    ...(user.whatsappPhone ? { whatsappPhone: user.whatsappPhone } : {}),
    photoURL: user.photoURL || null,
    status: initialState.status,
    paymentStatus: initialState.paymentStatus,
    requestedAt: Timestamp.now(),
    ...(typeof session.price === 'number' ? { paymentAmount: session.price } : {}),
    paymentCurrency: session.currency || 'ZMW',
  };
};

export const createSessionRegistration = async (
  session: Session,
  user: User,
  confirmedCount: number
) => {
  const userId = user.uid || user.id;
  return createDocumentWithId(
    'sessionRegistrations',
    getSessionRegistrationId(session.id, userId),
    buildSessionRegistrationPayload(session, user, confirmedCount)
  );
};

export const updateSessionRegistration = (
  registrationId: string,
  data: UpdateDocument<SessionRegistration>
) => updateDocument('sessionRegistrations', registrationId, data);
