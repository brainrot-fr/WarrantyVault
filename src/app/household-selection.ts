export const householdStorageKey = 'warrantyvault-household';
export const allHouseholdsValue = 'all';
const householdSelectionEvent = 'warrantyvault:household-selection-change';

export function readHouseholdSelection() {
  try {
    return window.localStorage.getItem(householdStorageKey) ?? allHouseholdsValue;
  } catch (error) {
    console.error('Could not read the saved household selection.', error);
    return allHouseholdsValue;
  }
}

export function persistHouseholdSelection(householdId: string) {
  try {
    if (householdId === allHouseholdsValue) {
      window.localStorage.removeItem(householdStorageKey);
    } else {
      window.localStorage.setItem(householdStorageKey, householdId);
    }

    window.dispatchEvent(new CustomEvent(householdSelectionEvent, { detail: householdId }));
  } catch (error) {
    throw new Error('Could not save the household selection.', { cause: error });
  }
}

export function subscribeToHouseholdSelection(callback: (householdId: string) => void) {
  const listener = (event: Event) => {
    if (event instanceof CustomEvent && typeof event.detail === 'string') {
      callback(event.detail);
    }
  };
  window.addEventListener(householdSelectionEvent, listener);
  return () => window.removeEventListener(householdSelectionEvent, listener);
}
