Read `feedback/bugs.json` and convert pending bug reports into GSD todos.

**Process:**

1. Read `feedback/bugs.json` (if it doesn't exist, inform user no bugs to sync)
2. Filter for bugs with `status: "pending"`
3. For each pending bug:
   - Create a todo using TodoWrite tool with format:
     - **content:** "Fix bug: {first 60 chars of description}"
     - **status:** "pending"
     - **activeForm:** "Fixing bug: {first 60 chars of description}"
   - Include the full bug details in your response (ID, timestamp, email, description, screenshot path)
4. After adding all bugs to todos, update bugs.json to mark synced bugs as `status: "in-progress"`
5. Report summary:
   - Number of bugs synced
   - List of bug IDs added to todos
   - Path to screenshot for each bug (if any)

**Important:**
- DO NOT mark bugs as "resolved" - only change "pending" → "in-progress"
- User will mark bugs as completed when they verify the fix
- After user verifies, manually edit bugs.json to set `status: "resolved"`
- Keep ALL bugs in the JSON file for historical record (don't delete)

**Output format:**

```
✅ Synced N bug reports from feedback/bugs.json

Added to todos:
1. [bug-123456789] Photos fade without changing (Screenshot: ./screenshots/screenshot-xyz.png)
2. [bug-234567890] NoSleep not working on iOS 16
...

Updated bugs.json: N bugs marked as "in-progress"

Next steps:
- Work through the todos to fix each bug
- Test fixes on production
- Manually update bugs.json to mark as "resolved" when verified
```

**If no pending bugs:**
```
No pending bugs to sync. All bugs are either in-progress or resolved.

Current bug stats:
- Pending: 0
- In-progress: N
- Resolved: M
```
