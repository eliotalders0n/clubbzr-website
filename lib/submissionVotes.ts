import { doc } from 'firebase/firestore';

import { db, executeTransaction, serverTimestamp, type OperationResult } from './firestore';
import type { QuestSubmission } from './schema';

export type SubmissionVoteValue = 1 | -1;

export interface QuestSubmissionVoteState {
  upvotes: string[];
  downvotes: string[];
  upvotesCount: number;
  downvotesCount: number;
  voteScore: number;
}

const uniqueIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((id): id is string => typeof id === 'string')));
};

export const getQuestSubmissionVoteSnapshot = (
  submission: Pick<QuestSubmission, 'upvotes' | 'downvotes' | 'upvotesCount' | 'downvotesCount' | 'voteScore'>
): QuestSubmissionVoteState => {
  const upvotes = uniqueIds(submission.upvotes);
  const downvotes = uniqueIds(submission.downvotes);

  return {
    upvotes,
    downvotes,
    upvotesCount: typeof submission.upvotesCount === 'number' ? submission.upvotesCount : upvotes.length,
    downvotesCount: typeof submission.downvotesCount === 'number' ? submission.downvotesCount : downvotes.length,
    voteScore: typeof submission.voteScore === 'number' ? submission.voteScore : upvotes.length - downvotes.length,
  };
};

export const getNextQuestSubmissionVoteState = (
  submission: Pick<QuestSubmission, 'upvotes' | 'downvotes' | 'upvotesCount' | 'downvotesCount' | 'voteScore'>,
  userId: string,
  vote: SubmissionVoteValue
): QuestSubmissionVoteState => {
  const current = getQuestSubmissionVoteSnapshot(submission);
  let upvotes = current.upvotes.filter((id) => id !== userId);
  let downvotes = current.downvotes.filter((id) => id !== userId);

  const alreadyUpvoted = current.upvotes.includes(userId);
  const alreadyDownvoted = current.downvotes.includes(userId);

  if (vote === 1 && !alreadyUpvoted) {
    upvotes = [...upvotes, userId];
  }

  if (vote === -1 && !alreadyDownvoted) {
    downvotes = [...downvotes, userId];
  }

  return {
    upvotes,
    downvotes,
    upvotesCount: upvotes.length,
    downvotesCount: downvotes.length,
    voteScore: upvotes.length - downvotes.length,
  };
};

export const updateQuestSubmissionVote = async (
  submissionId: string,
  userId: string,
  vote: SubmissionVoteValue
): Promise<OperationResult<QuestSubmissionVoteState>> => {
  return executeTransaction(async (transaction) => {
    const submissionRef = doc(db, 'questSubmissions', submissionId);
    const snapshot = await transaction.get(submissionRef);

    if (!snapshot.exists()) {
      throw new Error('Submission not found');
    }

    const submission = snapshot.data() as QuestSubmission;
    const nextState = getNextQuestSubmissionVoteState(submission, userId, vote);

    transaction.update(submissionRef, {
      ...nextState,
      updatedAt: serverTimestamp(),
    });

    return nextState;
  });
};
