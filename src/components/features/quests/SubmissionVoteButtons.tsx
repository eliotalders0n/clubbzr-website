'use client'

import { Button, HStack, Text } from '@chakra-ui/react'
import { ArrowDown, ArrowUp } from 'lucide-react'

import {
  getQuestSubmissionVoteSnapshot,
  type SubmissionVoteValue,
} from '../../../../lib/submissionVotes'
import type { QuestSubmission } from '../../../../lib/schema'

interface SubmissionVoteButtonsProps {
  submission: Pick<QuestSubmission, 'upvotes' | 'downvotes' | 'upvotesCount' | 'downvotesCount' | 'voteScore'>
  currentUserId?: string | null
  onVote: (vote: SubmissionVoteValue) => void | Promise<void>
  compact?: boolean
}

export function SubmissionVoteButtons({
  submission,
  currentUserId,
  onVote,
  compact = false,
}: SubmissionVoteButtonsProps) {
  const voteState = getQuestSubmissionVoteSnapshot(submission)
  const hasUpvoted = currentUserId ? voteState.upvotes.includes(currentUserId) : false
  const hasDownvoted = currentUserId ? voteState.downvotes.includes(currentUserId) : false

  return (
    <HStack gap={compact ? 1.5 : 2} align="center">
      <Button
        type="button"
        size="sm"
        minW={compact ? 10 : 12}
        h={compact ? 9 : 10}
        px={compact ? 2 : 3}
        borderRadius="full"
        bg={hasUpvoted ? 'green.500' : 'whiteAlpha.100'}
        color={hasUpvoted ? 'white' : 'whiteAlpha.700'}
        border="1px solid"
        borderColor={hasUpvoted ? 'green.400' : 'whiteAlpha.100'}
        _hover={{ bg: hasUpvoted ? 'green.600' : 'whiteAlpha.200', color: 'white' }}
        aria-label="Upvote submission"
        onClick={() => onVote(1)}
      >
        <ArrowUp size={compact ? 15 : 16} />
        {!compact && <Text as="span">{voteState.upvotesCount}</Text>}
      </Button>

      <Text
        minW={compact ? 6 : 8}
        textAlign="center"
        color={voteState.voteScore > 0 ? 'green.300' : voteState.voteScore < 0 ? 'red.300' : 'whiteAlpha.600'}
        fontSize={compact ? 'sm' : 'md'}
        fontWeight="bold"
        fontFamily="mono"
      >
        {voteState.voteScore}
      </Text>

      <Button
        type="button"
        size="sm"
        minW={compact ? 10 : 12}
        h={compact ? 9 : 10}
        px={compact ? 2 : 3}
        borderRadius="full"
        bg={hasDownvoted ? 'red.500' : 'whiteAlpha.100'}
        color={hasDownvoted ? 'white' : 'whiteAlpha.700'}
        border="1px solid"
        borderColor={hasDownvoted ? 'red.400' : 'whiteAlpha.100'}
        _hover={{ bg: hasDownvoted ? 'red.600' : 'whiteAlpha.200', color: 'white' }}
        aria-label="Downvote submission"
        onClick={() => onVote(-1)}
      >
        <ArrowDown size={compact ? 15 : 16} />
        {!compact && <Text as="span">{voteState.downvotesCount}</Text>}
      </Button>
    </HStack>
  )
}

export type { SubmissionVoteValue }
