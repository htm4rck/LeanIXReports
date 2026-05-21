import escape from 'lodash/escape';

export function escapeHtml(str) {
  return escape(str || '');
}

export function getShortName(displayName) {
  const parts = (displayName || '').split(' / ');
  return parts[parts.length - 1];
}
