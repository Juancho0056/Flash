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


## Part 2: UI/UX Responsiveness

### Objective
To verify that the application's global header and study page are responsive and provide an optimal user experience on various screen sizes, particularly mobile and tablet.

### Prerequisites
- Application running locally or on a test environment.
- A user account with some collections and flashcards.
- Browser developer tools for simulating different screen sizes.

### Test Cases - Global Header

#### Test Case GH1: Hamburger Menu Appearance (Mobile/Tablet)
1.  **Action**: Open the application on a small screen (e.g., simulate iPhone width, iPad width).
2.  **Verification**:
    *   **Expected Result**: The standard horizontal navigation links should be hidden. A hamburger menu icon should be visible. The "Total Score" and user email should also likely be hidden within this menu or not shown in the compact header.

#### Test Case GH2: Hamburger Menu Functionality
1.  **Action**: On a small screen, tap the hamburger menu icon.
2.  **Verification**:
    *   **Expected Result**: A dropdown or slide-out menu should appear, containing navigation links (Home, History, Logout/Login, etc.) and potentially the "Total Score" and user email. Links should be easily tappable.
3.  **Action**: Tap the "close" (X) icon or tap the hamburger icon again.
4.  **Verification**:
    *   **Expected Result**: The menu should close.

#### Test Case GH3: Desktop Header Layout
1.  **Action**: Open the application on a desktop screen size.
2.  **Verification**:
    *   **Expected Result**: The hamburger menu icon should be hidden. The standard horizontal navigation links, user email, and "Total Score" should be visible and correctly laid out.

### Test Cases - Study Page (`/study`)

#### Test Case SP1: Card Emphasis (Mobile)
1.  **Action**: Navigate to the study page on a small screen. Start a study session.
2.  **Verification**:
    *   **Expected Result**: The flashcard (`Card` component) should be the most prominent element, occupying a significant portion of the screen (e.g., ~70-80% of viewport height as aimed for). Other elements should be secondary.

#### Test Case SP2: Stats Visibility (Mobile)
1.  **Action**: On the study page (mobile view), observe the session statistics area (Score, Streak).
2.  **Verification**:
    *   **Expected Result**: Full session stats should be hidden by default. A "View Session Progress" (or similar) button should be visible.
3.  **Action**: Tap the "View Session Progress" button.
4.  **Verification**:
    *   **Expected Result**: The session statistics should become visible. The button text might change to "Hide Session Progress".
5.  **Action**: Tap the "Hide Session Progress" button.
6.  **Verification**:
    *   **Expected Result**: The session statistics should hide again.

#### Test Case SP3: Stats Visibility (Desktop)
1.  **Action**: Navigate to the study page on a desktop screen size. Start a study session.
2.  **Verification**:
    *   **Expected Result**: The session statistics should be visible by default. The "View/Hide Session Progress" button specific to mobile should not be visible.

#### Test Case SP4: Answer Buttons (Mobile)
1.  **Action**: On the study page (mobile view), observe the "Correct" and "Incorrect" answer buttons.
2.  **Verification**:
    *   **Expected Result**: The buttons should primarily display icons (e.g., checkmark, cross) and be compact. They should be easily tappable and well-spaced (e.g., `justify-around`).

#### Test Case SP5: Answer Buttons (Desktop)
1.  **Action**: On the study page (desktop view), observe the "Correct" and "Incorrect" answer buttons.
2.  **Verification**:
    *   **Expected Result**: The buttons should display text labels ("Correct", "Incorrect") and be appropriately sized for desktop interaction.

#### Test Case SP6: Progress Bar (All Screens)
1.  **Action**: On the study page, observe the progress bar.
2.  **Verification**:
    *   **Expected Result**: The progress bar should be thinner than its original design (e.g., `h-1.5`). It should display correctly on all screen sizes.

#### Test Case SP7: Configuration/Filter Controls (Mobile)
1.  **Action**: On the study page (mobile view), observe the area with "Shuffle," "Study Failed Only," etc., buttons.
2.  **Verification**:
    *   **Expected Result**: These buttons should wrap onto multiple lines or stack vertically if space is limited, without causing horizontal overflow. They should be aligned neatly (e.g., `justify-start` or `items-start` for the group). The "Card X of Y" text and this group of buttons should also stack vertically.

#### Test Case SP8: Configuration/Filter Controls (Desktop)
1.  **Action**: On the study page (desktop view), observe the "Shuffle," "Study Failed Only," etc., buttons.
2.  **Verification**:
    *   **Expected Result**: These buttons should be laid out in a row, typically aligned to the right, with the "Card X of Y" text to their left.

## Notes
- Pay attention to element alignment, spacing, and font sizes across different breakpoints.
- Test on actual mobile devices if possible, in addition to browser simulation.
