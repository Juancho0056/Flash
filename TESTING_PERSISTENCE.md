# Manual Test Cases for Session Persistence

## Objective
To verify that study session progress is correctly persisted and restored under various scenarios, ensuring the "total persistence" feature is working as expected.

## Prerequisites
- Application running locally or on a test environment.
- A user account with some collections and flashcards.

## Test Cases

### Test Case 1: Save on Page Unload (Tab Close)

1.  **Action**: Log in to the application.
2.  **Action**: Start a study session with a collection of at least 5 cards.
3.  **Action**: Answer 2-3 cards. Note the current card and statistics (score, correct/incorrect).
4.  **Action**: Flip the current card (if it's not already flipped) but do *not* answer it.
5.  **Action**: Close the browser tab directly.
6.  **Verification**:
    *   Open a new tab and navigate back to the application.
    *   Go to the same collection to study.
    *   The application should prompt to resume the session or offer to start fresh.
    *   Choose to resume.
    *   **Expected Result**: The session should resume at the exact card you were on (the one you flipped but didn't answer). The statistics (score, correct/incorrect counts from the 2-3 answered cards) should be restored. The flipped state of the current card should also ideally be restored if that level of detail is saved (though `flashcardsState` in `UserStudyProgress` saves `answeredInSession` and `failedInSession`, not flip state directly, so this specific part might depend on how `loadCollectionForStudy` re-initializes card states).

### Test Case 2: Save on Page Unload (Navigation Away)

1.  **Action**: Log in and start a study session.
2.  **Action**: Answer 1-2 cards.
3.  **Action**: Navigate away from the study page to another part of the application (e.g., the dashboard or collections list) using an internal link.
4.  **Action**: Navigate back to the study session for the same collection.
5.  **Verification**:
    *   The application should prompt to resume or start fresh.
    *   Choose to resume.
    *   **Expected Result**: The session should resume from where you left off, with stats restored.

### Test Case 3: Periodic Autosave (Idle Scenario)

1.  **Action**: Log in and start a study session.
2.  **Action**: Answer one card. Note the current card and stats.
3.  **Action**: Leave the study page open and idle on the *next* card for a duration longer than the autosave interval (e.g., if 30 seconds, wait for 45-60 seconds). Do not interact with the page.
4.  **Action**: (Simulate unexpected exit) Close the browser tab or force quit the browser (if possible and safe for your testing setup).
5.  **Verification**:
    *   Reopen the application and navigate to the same collection for study.
    *   Choose to resume.
    *   **Expected Result**: The session should have saved the state *after the first card was answered*, and you should resume on the card you were idle on. The stats should reflect the first answered card. This verifies the autosave happened while idle.

### Test Case 4: Session Completion and `UserStudyProgress` Clearing

1.  **Action**: Log in and start a study session with a small collection (e.g., 3-5 cards).
2.  **Action**: Complete the entire session (answer all cards).
3.  **Verification**:
    *   A `StudySessionRecord` should be created (can be verified by checking the study history page or network logs for the API call to `/api/study-history`).
    *   Navigate away from the study page and then return to study the *same collection again*.
    *   **Expected Result**: The application should *not* prompt to resume an in-progress session for this collection (unless it's now in "review mode," which is a separate state). It should start fresh or offer to start a review. `UserStudyProgress` for that collection should have been cleared or appropriately handled.

### Test Case 5: No Save in Review Mode

1.  **Action**: Log in. Ensure a collection has been previously "mastered" or completed to activate "Review Mode" for it, or manually enable review mode if there's a toggle.
2.  **Action**: Start a study session for that collection in "Review Mode".
3.  **Action**: Answer a few cards.
4.  **Action**: Close the tab.
5.  **Verification**:
    *   Reopen and go back to study the same collection (still in Review Mode if that state persists, or re-enable it).
    *   **Expected Result**: The session should *not* resume from the specific card you left off on during the review. Progress within a review session itself is not intended to be persisted by `UserStudyProgress` (as per `saveProgressForCurrentCollection` logic). It should start the review from the beginning or based on its own review logic.

### Test Case 6: Restarting a Session

1.  **Action**: Log in and start a study session. Answer a few cards.
2.  **Action**: Close the tab and reopen, resume the session. Verify it resumes correctly.
3.  **Action**: Find and use the "Restart Session" (or similar) button/feature for the current collection.
4.  **Verification**:
    *   **Expected Result**: The session should reset to the beginning. All previous progress for *this specific attempt* (currentIndex, stats within `UserStudyProgress`) should be wiped.
    *   Close the tab and reopen. Navigate to the same collection.
    *   **Expected Result**: It should start fresh, not offer to resume the partially completed session that you then restarted.

## Notes
- Use browser developer tools (Network tab) to observe API calls to `/api/user-progress` (for saving ongoing progress) and `/api/study-history` (for saving completed sessions). This can help confirm when saves are happening.
- Check the database directly (if accessible) to inspect `UserStudyProgress` and `StudySessionRecord` tables for more detailed verification.
