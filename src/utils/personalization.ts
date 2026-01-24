import { NoteType } from '@/types/note';

interface OnboardingAnswers {
  0?: string;
  1?: string;
  2?: string;
  3?: string;
  4?: string;
  5?: string;
  6?: string;
}

export const getPersonalizedRecommendations = (answers: OnboardingAnswers) => {
  const recommendations: string[] = [];

  if (answers[0] === 'work') {
    recommendations.push('Use mind maps for meeting notes and project planning');
  } else if (answers[0] === 'journal') {
    recommendations.push('Try lined notes for daily journaling and reflection');
  } else if (answers[0] === 'study') {
    recommendations.push('Organize study materials with folders by subject');
  } else if (answers[0] === 'creative') {
    recommendations.push('Explore sketch notes to visualize your creative ideas');
  }

  if (answers[1] === 'folders') {
    recommendations.push('Create folders for each project or topic');
  } else if (answers[1] === 'tags') {
    recommendations.push('Pin important notes to keep them easily accessible');
  } else if (answers[1] === 'colors') {
    recommendations.push('Use sticky notes with different colors for categorization');
  }

  if (answers[2] === 'bullets') {
    recommendations.push('Quick capture with to-do lists for action items');
  } else if (answers[2] === 'voice') {
    recommendations.push('Use voice recordings to capture thoughts on the go');
  } else if (answers[2] === 'sketches') {
    recommendations.push('Mind maps are perfect for diagrams and visual thinking');
  }

  if (answers[6] === 'habits') {
    recommendations.push('Set a daily reminder to review and update your notes');
  } else if (answers[6] === 'organization') {
    recommendations.push('Spend 5 minutes weekly organizing notes into folders');
  } else if (answers[6] === 'capture') {
    recommendations.push('Use sticky notes for instant capture, organize later');
  }

  return recommendations.slice(0, 3);
};

export const getSuggestedNoteTypes = (answers: OnboardingAnswers): NoteType[] => {
  const types: NoteType[] = [];

  if (answers[0] === 'work') {
    types.push('mindmap', 'regular');
  } else if (answers[0] === 'journal') {
    types.push('lined', 'regular');
  } else if (answers[0] === 'study') {
    types.push('mindmap', 'code');
  } else if (answers[0] === 'creative') {
    types.push('sketch', 'sticky');
  }

  if (answers[2] === 'bullets') {
    types.push('regular');
  } else if (answers[2] === 'voice' && !types.includes('regular')) {
    types.push('regular');
  } else if (answers[2] === 'sketches') {
    types.push('sketch', 'mindmap');
  }

  return [...new Set(types)].slice(0, 3);
};

export const getSuggestedFolders = (answers: OnboardingAnswers): string[] => {
  const folders: string[] = [];

  if (answers[0] === 'work') {
    folders.push('Projects', 'Meetings', 'Ideas');
  } else if (answers[0] === 'journal') {
    folders.push('Daily Journal', 'Reflections', 'Goals');
  } else if (answers[0] === 'study') {
    folders.push('Lectures', 'Assignments', 'Study Guides');
  } else if (answers[0] === 'creative') {
    folders.push('Ideas', 'Drafts', 'Inspiration');
  }

  return folders;
};
