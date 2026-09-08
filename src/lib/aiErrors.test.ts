import { expect, it } from 'vitest';
import { friendlyAiErrorMessage } from './aiErrors';
it('distinguishes missing integrations, user authentication and network failures from OpenAI billing', () => {
  expect(friendlyAiErrorMessage('FamilySearch Client ID no configurado', 'familysearch-auth')).toContain('FamilySearch');
  expect(friendlyAiErrorMessage('Invalid JWT', 'ai-genealogy')).toContain('sesión');
  expect(friendlyAiErrorMessage('Failed to fetch', 'familysearch-auth')).not.toContain('OpenAI');
  expect(friendlyAiErrorMessage('Función no desplegada', 'familysearch-sync')).toContain('servidor');
  expect(friendlyAiErrorMessage('invalid_api_key', 'ai-genealogy')).toContain('OpenAI');
});
