# Dropdown Menu Navigation Study — GitHub Pages Version

This package is a GitHub Pages-ready, browser-based formal experiment for comparing **horizontal** versus **vertical** menu navigation speed and accuracy. The implementation is designed to support a strong experimental defense for Assignment 9, which asks for a formal experiment with clearly defined variables, controlled conditions, consistent instructions, and a pilotable implementation.

## Files
- `index.html` — main experiment page
- `styles.css` — fixed-frame controlled layout and grayscale styling
- `app.js` — experiment logic, randomization, timing, export, and spreadsheet POST
- `google_apps_script.gs` — Google Apps Script backend for writing results into a Google Sheet

## Design Summary
- **Design type:** within-subjects
- **Order control:** the starting layout is randomized with equal probability (`horizontal → vertical` or `vertical → horizontal`)
- **Per block:** 1 practice trial + 8 measured trials
- **Dependent variables:** reaction time in milliseconds, correctness/error rate
- **Stimulus control:** all top-level buttons use identical dimensions in both conditions; all submenu item buttons also use identical dimensions in both conditions
- **Interaction control:** both conditions use identical hover-to-open behavior and identical click-to-select behavior
- **Start-point control:** every trial begins from the same central start button; the timer begins only after that button is clicked
- **Distance control:** the perpendicular distance from the center start point to the boundary of the top bar or side bar is identical by construction
- **Instruction control:** every measured instruction shows the full path (for example, `Edit → Copy`) rather than only the terminal label
- **Visual control:** grayscale testing screen, no icons, no color cueing between conditions, and no condition labels on the test screen
- **Scaling control:** the experiment runs inside a fixed-size frame; if the viewport is too small, the page blocks the trial and asks the user to resize the browser

## Important Validity Notes
- This implementation removes many obvious confounds: different wording, different icons/emojis, different feedback styles, different color usage, different starting positions, and different interaction methods.
- The layout order is randomized to reduce order effects.
- The menu content order is re-randomized each trial so that participants cannot rely on memorizing a fixed location map.
- Because participants can visibly see whether the current block is top-oriented or side-oriented, this is **not a perfect true double-blind experiment**. A more accurate claim is: **the hypothesis is concealed from participants, the block order is randomly assigned, and the testing screen hides explicit condition labels.** That is a defensible partial-blind / single-blind setup for a visible interaction experiment.
- No browser experiment can reduce geometry differences to literally zero when comparing top versus side menu placement. This implementation controls everything practical around the manipulation as tightly as possible, while keeping the manipulation itself intact.

## Google Sheets Setup
1. Create a new Google Sheet.
2. Open **Extensions → Apps Script**.
3. Paste the contents of `google_apps_script.gs`.
4. Optionally set `EXPECTED_SECRET` in the Apps Script file.
5. Deploy as a **Web app**.
   - Execute as: **Me**
   - Access: whatever level works for your participant setup
6. Copy the deployment URL.
7. Paste that URL into `GOOGLE_APPS_SCRIPT_URL` in `app.js`.
8. If you used a secret, put the same value into `SHARED_SECRET` in `app.js`.

## GitHub Pages Setup
1. Put all four files in a GitHub repository.
2. Enable **GitHub Pages** for the repository.
3. Serve from the branch/folder containing `index.html`.
4. Open the Pages URL in a desktop/laptop browser.

## Suggested Pilot Checklist
- Verify the viewport warning appears on small windows.
- Verify the central start button is always shown before a trial begins.
- Verify the menu cannot be used before the trial starts.
- Verify block order is random across different sessions.
- Verify results download as JSON and post to the Google Sheet.
- Verify only measured trials are included in the summary statistics.


## Update
- Signup/consent pages were shortened to reduce unnecessary instruction load before the measured task.
- The fixed-frame browser resize gate was removed. The experiment now auto-scales the full controlled frame to fit the participant window while preserving internal proportions. For best consistency, laptop/desktop at normal zoom is still recommended.


Update: the testing view now shows only the target path, the start control, and the menu region. Hidden DOM nodes retain internal status hooks for script compatibility without affecting visible layout.


Fix: removed inner frame masks and raised menu/dropdown stacking order so the dropdown lists remain visible above the minimal stage chrome.


Runtime fix: restored hidden feedback/post-status nodes required by app.js so the trial view initializes correctly.
