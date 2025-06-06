# Manual Test Cases for Gamification Features

## Part 1: Total Accumulated Score Display

### Objective
To verify that the total accumulated score is correctly calculated and displayed in the global header. The score should represent the sum of the user's maximum scores for each unique collection they have studied.

### Prerequisites
- Application running locally or on a test environment.
- A user account.
- Access to the database (optional, for verification of `StudySessionRecord` entries).

### Test Cases

#### Test Case GS1: New User (No Study History)
1.  **Action**: Register a new user or log in with a user who has no study session history.
2.  **Verification**:
    *   Observe the global header.
    *   **Expected Result**: The "Total Score" should be displayed as `0`.

#### Test Case GS2: First Study Session
1.  **Action**: Log in as a user (can be the new user from GS1).
2.  **Action**: Start a study session with "Collection A".
3.  **Action**: Complete the session, achieving a score of, for example, 50 points.
4.  **Verification**:
    *   Observe the global header.
    *   **Expected Result**: The "Total Score" should update to `50`.

#### Test Case GS3: Multiple Collections
1.  **Action**: Using the same user from GS2.
2.  **Action**: Start a study session with "Collection B".
3.  **Action**: Complete the session, achieving a score of, for example, 70 points.
4.  **Verification**:
    *   Observe the global header.
    *   **Expected Result**: The "Total Score" should update to `120` (50 from Collection A + 70 from Collection B).

#### Test Case GS4: Re-studying a Collection (Higher Score)
1.  **Action**: Using the same user.
2.  **Action**: Re-study "Collection A".
3.  **Action**: Complete the session, this time achieving a score of 80 points (higher than the previous 50).
4.  **Verification**:
    *   Observe the global header.
    *   **Expected Result**: The "Total Score" should update to `150` (80 from Collection A (new max) + 70 from Collection B).

#### Test Case GS5: Re-studying a Collection (Lower Score)
1.  **Action**: Using the same user.
2.  **Action**: Re-study "Collection B".
3.  **Action**: Complete the session, this time achieving a score of 40 points (lower than the previous 70).
4.  **Verification**:
    *   Observe the global header.
    *   **Expected Result**: The "Total Score" should remain `150` (80 from Collection A + 70 from Collection B (previous max maintained)).

#### Test Case GS6: Score Display After Logout and Login
1.  **Action**: Using the same user (who has an accumulated score, e.g., 150).
2.  **Action**: Log out of the application.
3.  **Verification**:
    *   Observe the global header.
    *   **Expected Result**: The "Total Score" display should disappear (or show nothing relevant to a score if the user is logged out).
4.  **Action**: Log back in as the same user.
5.  **Verification**:
    *   Observe the global header.
    *   **Expected Result**: The "Total Score" should be displayed correctly as `150`.

#### Test Case GS7: Sessions with Zero or Null Scores (if possible)
1.  **Setup**: If the system can record a `StudySessionRecord` with a score of `0` or `null` (though `score` is likely non-nullable and defaults to 0).
2.  **Action**: Create such a session for a new "Collection C".
3.  **Verification**:
    *   Observe the global header.
    *   **Expected Result**: The total score should not be negatively affected or cause errors. A score of `0` for Collection C should simply add `0` to the total. (The `calculateUserTotalScore` function already treats null scores as 0).

## Notes
- Use browser developer tools if needed, but the primary verification is the visual display in the header.
- If database access is available, cross-verify the `score` in `StudySessionRecord` for the user and collections to manually calculate the expected total score.
