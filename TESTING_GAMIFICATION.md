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

## Part 3: Mobile Study UI Refinements (Phase 1)

### Objective
To verify that recent UI refinements to the global navbar (mobile) and the study page (mobile) have been implemented correctly, improving usability, focus, and layout on smaller screens.

### Prerequisites
- Application running locally or on a test environment.
- A user account with some collections and flashcards.
- Browser developer tools for simulating different screen sizes.

### Test Cases - Global Navbar (Mobile)

#### Test Case N1: Navbar Height and Compactness (Mobile)
1.  **Action**: Open the application on a small screen (e.g., simulate iPhone width).
2.  **Verification**:
    *   **Expected Result**: The global navbar should appear noticeably shorter/more compact than its previous version.
    *   The app title, a compact user score (e.g., "150pts"), a truncated user email, and the hamburger icon should all be visible in a single row and appropriately sized for the reduced height.
    *   Ensure there's no awkward text wrapping or element collision within the compact navbar.

### Test Cases - Study Page (`/study`) - Mobile View

#### Test Case SP9: Reduced Spacing Around Card
1.  **Action**: Navigate to the study page on a small screen. Start a study session.
2.  **Verification**:
    *   **Expected Result**: The overall spacing above and below the flashcard area should be reduced. The flashcard itself should feel more central and less pushed down by elements above or separated from controls below.
    *   The `study-area` padding should be visibly less on small screens.
    *   The `card-wrapper` should still ensure the card is prominent, but the `min-height-[60vh]` should allow for flexibility if card content is small, preventing excessive internal whitespace.

#### Test Case SP10: Consolidated Control Bar - Layout & Proximity
1.  **Action**: On the study page (mobile view), observe the area below the flashcard and score display.
2.  **Verification**:
    *   **Expected Result**: The "Previous", "Incorrect", "Correct", and "Next" buttons should now be grouped together in a single horizontal bar.
    *   This control bar should be positioned closely below the score display (which is below the card), with reduced top margin compared to the previous layout.
    *   The buttons within the bar should be appropriately spaced (e.g., `justify-between` or using `flex-grow` on answer buttons effectively).

#### Test Case SP11: Consolidated Control Bar - Button Styles (Mobile)
1.  **Action**: Examine the buttons within the consolidated control bar on mobile.
2.  **Verification**:
    *   **"Incorrect" & "Correct" Buttons**: Should display as icons (e.g., cross and checkmark). Icons should be clear and buttons easily tappable (check size/padding like `p-3`). They should expand to fill space (`flex-grow`).
    *   **"Previous" & "Next" Buttons**: Should display as icons (e.g., chevrons). They should be compact (`p-2.5`) but tappable.
    *   All buttons should have `aria-label` attributes for accessibility.

#### Test Case SP12: Consolidated Control Bar - Button Styles (Desktop)
1.  **Action**: Switch to a desktop view of the study page.
2.  **Verification**:
    *   **Expected Result**: The consolidated control bar should still be present.
    *   "Incorrect" & "Correct" buttons should display their text labels. `flex-grow` should be reset so they don't unnaturally expand.
    *   "Previous" & "Next" buttons should display their text labels and have desktop-appropriate padding.
    *   The bar should be appropriately aligned (e.g., `md:mt-8` for top margin).

#### Test Case SP13: Functionality of Consolidated Controls
1.  **Action**: On both mobile and desktop views, interact with all buttons in the consolidated control bar.
2.  **Verification**:
    *   **Expected Result**:
        *   "Previous" and "Next" buttons should navigate through cards correctly. Their disabled states for single-card decks or at ends of deck should work.
        *   "Incorrect" and "Correct" buttons should correctly mark answers, update stats, and their disabled states (e.g., after answering) should function as before.
        *   No change in logical functionality is expected, only layout and styling.

## Notes
- Test across various mobile viewport sizes (e.g., iPhone SE, iPhone Pro Max, common Android sizes).
- Check for any unintended layout shifts or style overrides affecting other parts of the study page or application.

## Part 4: Study Page Enhancements (Phase 2)

### Objective
To verify the correct implementation and usability of recent enhancements to the study page: relocated auto-speak toggle, toast-based badge messages, and the new Focus Mode.

### Prerequisites
- Application running locally or on a test environment.
- A user account with some collections and flashcards.
- Browser developer tools for simulating different screen sizes and inspecting elements.

### Test Cases - Auto-Speak Toggle Relocation

#### Test Case AST1: Toggle Position and Appearance
1.  **Action**: Navigate to the study page (`/study`) and load a collection.
2.  **Verification**:
    *   **Expected Result**: The auto-speak toggle (speaker icon and checkbox/switch, possibly with "Speak" text on slightly larger small screens) should be visible in the top-right area of the flashcard container (`card-wrapper`).
    *   It should not obscure important card content.
    *   It should have a slight background if it overlays card imagery, ensuring visibility.

#### Test Case AST2: Toggle Functionality
1.  **Action**: Click/tap the auto-speak toggle (either the icon, text, or checkbox).
2.  **Verification**:
    *   **Expected Result**: The toggle state should change (e.g., checkbox visually checks/unchecks). The `autoPlayTTS` store value in `ttsStore.ts` should update accordingly. If TTS is functional, card auto-speaking behavior should toggle on/off when new cards are displayed or flipped (depending on specific TTS trigger logic).
3.  **Action**: Refresh the page or navigate away and back to a study session.
4.  **Verification**:
    *   **Expected Result**: The toggle should remember its previous state (as it's typically persisted via `ttsStore` and local storage, though this test primarily focuses on the UI element itself).

### Test Cases - Badge Message (Collection Perfect Toast)

#### Test Case BM1: Toast on First Perfection
1.  **Action**: Start a study session with a small collection (e.g., 2-3 cards).
2.  **Action**: Answer all cards correctly without any incorrect answers.
3.  **Verification**:
    *   **Expected Result**: Upon correctly answering the last card and completing the session perfectly, a success toast notification should appear. The toast should contain a message like "🏆 ¡Colección '[Collection Name]' perfecta! Has dominado todas las tarjetas. ¡Bien hecho!".
    *   The old static paragraph message for collection perfection should NOT be visible.

#### Test Case BM2: No Toast on Subsequent Views (Same Session State)
1.  **Action**: After the toast in BM1 appears, navigate to the next/previous card (if possible, though session is complete) or interact with UI elements that don't reset the session.
2.  **Verification**:
    *   **Expected Result**: The "Collection Perfect" toast should NOT reappear.

#### Test Case BM3: Toast Reset on New Collection Load
1.  **Action**: After BM1, load a *different* small collection.
2.  **Action**: Answer all cards correctly in this new collection.
3.  **Verification**:
    *   **Expected Result**: The "Collection Perfect" toast should appear for this new collection.

#### Test Case BM4: Toast Reset on Session Restart
1.  **Action**: After BM1, use the "Study Again (Same Collection)" or "Restart Session" functionality for the *same* collection.
2.  **Action**: Answer all cards correctly again.
3.  **Verification**:
    *   **Expected Result**: The "Collection Perfect" toast should appear again for this re-perfected session.

#### Test Case BM5: No Toast if Not Perfect
1.  **Action**: Start a study session. Answer at least one card incorrectly, then complete the session.
2.  **Verification**:
    *   **Expected Result**: The "Collection Perfect" toast should NOT appear.

#### Test Case BM6: No Toast in Filtered/Review Modes
1.  **Action**: Start a study session. Get some cards correct, some incorrect.
2.  **Action**: Enter "Study Failed Only" mode. Answer all remaining (failed) cards correctly.
3.  **Verification**:
    *   **Expected Result**: The "Collection Perfect" toast should NOT appear (as it's a filtered view, not the whole collection initially).
4.  **Action**: (If applicable) Enter "Review Mode" for a collection and complete it perfectly.
5.  **Verification**:
    *   **Expected Result**: The "Collection Perfect" toast should NOT appear.


### Test Cases - Focus Mode

#### Test Case FM1: Toggle Button and Initial State
1.  **Action**: Navigate to the study page and load a collection.
2.  **Verification**:
    *   **Expected Result**: A "Focus Mode" toggle button (with an eye icon and/or "Focus" text) should be visible among the control buttons (near Shuffle/Filters). Focus mode should be OFF by default.

#### Test Case FM2: Enabling Focus Mode
1.  **Action**: Click/tap the "Focus Mode" toggle button.
2.  **Verification**:
    *   **Expected Result**:
        *   The button icon/text should change (e.g., to an eye-slash icon / "Unfocus" text).
        *   Non-essential UI elements should disappear. This includes:
            *   Collection selection dropdown.
            *   "View Session Progress" button / `SessionStats` component.
            *   Auto-speak toggle (on the card wrapper).
            *   "Card X of Y" text and the filter/shuffle/focus mode buttons themselves.
            *   Progress bar.
            *   Score display area.
            *   "Back to Collections List" link.
        *   The flashcard (`Card` component) and the consolidated control bar (Previous, Incorrect, Correct, Next buttons) should remain visible and become the central focus.
        *   The layout should adjust to center the card and controls, potentially taking more vertical space.

#### Test Case FM3: Disabling Focus Mode
1.  **Action**: While in Focus Mode, click/tap the (now hidden, so this tests if it reappears correctly or if another mechanism is intended) Focus Mode toggle button again. **Clarification**: The subtask report stated the focus button itself is hidden. This test needs to verify how focus mode is *disabled*. If the button is indeed hidden, this test case needs adjustment (e.g., "Complete the session" or "Reload the collection" to see if focus mode resets). *Self-correction: The focus mode button is part of the group that gets hidden. Focus mode would be disabled by toggling it again *before* it's hidden, or by an alternative method like an ESC key if implemented, or by session reset.* For this test, assume the user toggles it off using the *same button which then hides itself*. The *next* time they enter focus mode, the button would be there again to *initiate* it. The test is more about the *state change* and *UI restoration*.
2.  **Action (Revised for FM3)**: Enable Focus Mode. Then, to disable it, click the Focus Mode button again (which would have just changed to "Unfocus" or an eye-slash icon).
3.  **Verification**:
    *   **Expected Result**: All previously hidden UI elements should reappear. Focus mode should be OFF. The toggle button should revert to its "Enable Focus Mode" state (eye icon / "Focus" text).

#### Test Case FM4: Functionality in Focus Mode
1.  **Action**: Enable Focus Mode.
2.  **Action**: Interact with the visible elements:
    *   Flip the card.
    *   Answer cards using "Correct" / "Incorrect" buttons.
    *   Navigate using "Previous" / "Next" buttons.
3.  **Verification**:
    *   **Expected Result**: All card interactions and control bar functionalities should work as normal. Stats should still update in the background (verifiable by disabling focus mode).

#### Test Case FM5: Focus Mode State Persistence/Reset
1.  **Action**: Enable Focus Mode.
2.  **Action**: Select a new collection to study. (This will require disabling Focus Mode first to access the collection selector).
3.  **Verification**:
    *   **Expected Result**: When a new collection is loaded (after Focus Mode was disabled, then collection changed, then new collection loaded), Focus Mode should be OFF by default for the new collection.
4.  **Action**: Enable Focus Mode for the current collection. Refresh the browser page.
5.  **Verification**:
    *   **Expected Result**: After page refresh and session resumption (if applicable for the collection), Focus Mode should be OFF by default. (As per `isFocusModeActive.set(false)` in `loadCollectionForStudy`).

## Notes
- Test Focus Mode on various mobile screen sizes to ensure the card and essential controls are well-centered and usable.
- Pay attention to any layout shifts when toggling Focus Mode.
- **Regarding FM3 (Disabling Focus Mode)**: The current implementation hides the focus mode button itself when focus mode is active. This means the primary way to *exit* focus mode would be to toggle it *before* the button disappears (if the UI updates fast enough) or implicitly when the session ends/resets (e.g., `loadCollectionForStudy` or `resetStudyState` which set `isFocusModeActive` to `false`). An alternative explicit exit (like an ESC key or a visible 'exit focus' affordance) is not part of the current scope but should be noted if usability issues arise. For testing, ensure that if focus mode *is* active and the session resets or a new collection loads, focus mode is correctly turned off.

## Part 5: Study Page UX Enhancements (Phase 3)

### Objective
To verify the correct implementation and usability of recent UX enhancements to the study page: automatic scrolling for the current card, refined UI after session completion, and modal display for statistics on mobile.

### Prerequisites
- Application running locally or on a test environment.
- A user account with some collections and flashcards.
- Browser developer tools for simulating different screen sizes and inspecting elements.

### Test Cases - scrollIntoView for Current Flashcard

#### Test Case SIV1: Scroll on Card Navigation (Next/Previous)
1.  **Action**: Open the study page with a collection of multiple cards. Ensure the page is scrollable (e.g., by making the browser window shorter or if other content pushes the card down).
2.  **Action**: Click "Next Card" or "Previous Card".
3.  **Verification**:
    *   **Expected Result**: The `card-wrapper` (the area containing the flashcard) should smoothly scroll to be centered (or close to centered) in the viewport. This should not happen if Focus Mode is active.

#### Test Case SIV2: Scroll on Initial Collection Load
1.  **Action**: Load a collection for study (either by selecting from dropdown or via URL parameter). Ensure the page is initially positioned such that the card area would not be centered without scrolling.
2.  **Verification**:
    *   **Expected Result**: Upon the first card appearing, the `card-wrapper` should smoothly scroll to the center of the viewport (unless Focus Mode is active).

#### Test Case SIV3: Scroll on Shuffle
1.  **Action**: In a study session with multiple cards, click the "Shuffle" button.
2.  **Verification**:
    *   **Expected Result**: After the cards are shuffled and the new current card is displayed, the `card-wrapper` should smoothly scroll to the center (unless Focus Mode is active).

#### Test Case SIV4: No Scroll in Focus Mode
1.  **Action**: Enable Focus Mode.
2.  **Action**: Navigate between cards using "Next" or "Previous".
3.  **Verification**:
    *   **Expected Result**: The specific `scrollIntoView` logic (with `block: 'center'`) should NOT be triggered. Focus Mode has its own layout which should already ensure the card is central; the explicit scrolling might cause jitter or conflict.

### Test Cases - Refined Post-Collection Completion UI

#### Test Case PCC1: UI Elements Hidden on Session Completion
1.  **Action**: Start a study session and answer all cards to complete it. The session summary modal should appear.
2.  **Verification**:
    *   **Expected Result**: Behind the modal (or if the modal is closed without starting a new session immediately), the following UI elements on the study page should be hidden:
        *   Consolidated control bar (Next/Prev/Correct/Incorrect buttons).
        *   "View Session Progress" button (mobile).
        *   `SessionStats` component (if it was visible on desktop).
        *   Auto-speak toggle.
        *   "Card X of Y" text and filter/shuffle/focus mode buttons.
        *   Progress bar.
        *   Main score display.
        *   Individual card stats ("Viewed/Correct") and "Mark as difficult" button.

#### Test Case PCC2: UI Elements Reappear After Modal Action (e.g., Study Again)
1.  **Action**: After completing a session (PCC1), interact with the session summary modal by choosing an option that starts a new session (e.g., "Study Again (Same Collection)" or "Review Failed Only").
2.  **Verification**:
    *   **Expected Result**: The UI elements listed in PCC1 should reappear as appropriate for the start of a new session (e.g., controls active, progress bar at start, stats reset or relevant to the new mode). `$sessionCompleted` should be false.

#### Test Case PCC3: UI Elements Reappear After Modal Close (Free Review)
1.  **Action**: After completing a session (PCC1), close the session summary modal using its "Close" or "Cancel" button (which should set `$sessionCompleted` to `false` to allow free review of cards).
2.  **Verification**:
    *   **Expected Result**: The UI elements listed in PCC1 should reappear, allowing the user to freely browse the completed deck (though answer buttons would be disabled for already answered cards). The state should reflect that the session *was* completed but is now being reviewed passively.

### Test Cases - Improved Mobile Statistics Display (Modal)

#### Test Case MSD1: Modal Trigger (Mobile)
1.  **Action**: On a mobile screen, navigate to the study page and start a session.
2.  **Action**: Tap the "View Session Progress" button.
3.  **Verification**:
    *   **Expected Result**: A modal dialog should appear, titled "Session Statistics". The `SessionStats` component content should be displayed within this modal.

#### Test Case MSD2: Modal Close
1.  **Action**: With the statistics modal open (MSD1), tap the "Close" button (or equivalent cancel action) in the modal.
2.  **Verification**:
    *   **Expected Result**: The modal should close, and the underlying study page should be visible and interactive.

#### Test Case MSD3: Stats Content in Modal
1.  **Action**: Open the statistics modal on mobile.
2.  **Action**: Interact with the study session (e.g., answer a few cards). Then, reopen the statistics modal.
3.  **Verification**:
    *   **Expected Result**: The statistics displayed within the modal should be up-to-date, reflecting the current state of the session. `SessionStats` component is rendering correctly within the modal context.

#### Test Case MSD4: Desktop Stats Display (Inline)
1.  **Action**: On a desktop screen, navigate to the study page and start a session.
2.  **Verification**:
    *   **Expected Result**: The `SessionStats` component should be displayed inline (not in a modal) as before, provided Focus Mode is not active and the session is not completed. The "View Session Progress" button (for mobile modal) should not be visible.

## Notes
- Test `scrollIntoView` on pages with varying amounts of content to ensure it behaves well.
- For post-collection completion, verify the state of `$sessionCompleted` using dev tools if needed to understand UI transitions.
- Ensure the mobile stats modal is well-styled and readable.
