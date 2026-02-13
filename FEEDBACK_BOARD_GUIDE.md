# 正反馈 Board Guide

The 正反馈 (Positive Feedback) Board is a new feature that helps you track and organize your positive feedback items, similar to how the task board works.

## How It Works

### 1. Tagging Lines

To add an item to the 正反馈 board:
- Add the `#正反馈` or `#❤️` tag on any line (both work as trigger tags)
- Add one or more topic tags (e.g., `#coding`, `#learning`, `#work`) on the SAME line
- Only the specific line with the trigger tag will be shown on the board
- The tags are removed from the displayed text

Example:
```markdown
# Daily Notes

Some random text here that won't appear on the board.

#❤️ Today I successfully implemented a new feature! #coding

More text that won't appear on the board.

- [ ] #work Some task (this won't appear on feedback board)
```

**What appears on the board:**
- "Today I successfully implemented a new feature!" (under #coding topic)

### 2. Topic Organization

- **Trigger tag** (`#正反馈` or `#❤️`): Marks the line to be saved to the board
- **Topic tag(s)** (e.g., `#coding`): Categorizes the item by topic
- Items with multiple topic tags will appear in all relevant topic sections
- Tags are removed from the displayed text for clean reading

### 3. Opening the Board

There are two ways to open the 正反馈 board:
1. Click the **heart icon** (❤️) in the left ribbon
2. Use the command palette: "Open 正反馈 board"

### 4. Using the Board

- **Click on topic headers** to collapse/expand sections
- **Click on the source note badge** to open the note at that specific line
- **Click the × button** to remove an item from the board
- **Click the refresh button** to manually update the board

### 5. Uncategorized Items

If a line has only `#正反馈` or `#❤️` but no other topic tags, it will appear in the "未分类" (Uncategorized) section.

## Examples

### Coding Achievement
```markdown
#❤️ Successfully refactored the authentication module today! #coding #refactoring
```
Shows: "Successfully refactored the authentication module today!" under #coding and #refactoring

### Learning Milestone
```markdown
#正反馈 Finished the advanced TypeScript course. Learned so much! #learning
```
Shows: "Finished the advanced TypeScript course. Learned so much!" under #learning

### Work Recognition
```markdown
Got positive feedback from the team on my presentation. #❤️ #work #communication
```
Shows: "Got positive feedback from the team on my presentation." under #work and #communication

## Settings

The feedback board shares settings with the task board:
- **Excluded tags**: Tags to ignore when organizing
- **Excluded folders**: Folders to skip when scanning
- **Show source note**: Display note metadata
- **Topic sort order**: How to sort topic sections (alphabetical or by count)

## Notes

- The board automatically scans all markdown files in your vault, line by line
- Removing the `#正反馈` or `#❤️` tag from a line will remove it from the board
- The board updates automatically when you create, modify, or delete notes
- Each line with a trigger tag is treated as a separate feedback item
- Task checkbox lines (starting with `- [ ]` or `- [x]`) are NOT scanned for feedback tags
