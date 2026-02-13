# 😒 负反馈board Guide

The 😒 负反馈board (Negative Feedback Board) is a feature that helps you track and organize things that frustrate you, need improvement, or require attention. It works similarly to the ❤️ 正反馈board but focuses on areas for improvement and active concerns.

## How It Works

### 1. Tagging Lines

To add an item to the active feedback board:
- Add the `#😒` tag on any line (this is the trigger tag)
- Add one or more topic tags (e.g., `#work`, `#coding`, `#productivity`) on the SAME line
- Only the specific line with the trigger tag will be shown on the board
- The tags are removed from the displayed text

Example:
```markdown
# Daily Notes

Some random text here that won't appear on the board.

#😒 The deployment process is still too slow and needs optimization #work #devops

More text that won't appear on the board.

- [ ] #coding Some task (this won't appear on feedback board)
```

**What appears on the board:**
- "The deployment process is still too slow and needs optimization" (under #work and #devops topics)

### 2. Topic Organization

- **Trigger tag** (`#😒`): Marks the line to be saved to the board
- **Topic tag(s)** (e.g., `#work`): Categorizes the item by topic
- Items with multiple topic tags will appear in all relevant topic sections
- Tags are removed from the displayed text for clean reading

### 3. Opening the Board

There are two ways to open the 负反馈board:
1. Click the **frown icon** (😒) in the left ribbon
2. Use the command palette: "Open 😒 负反馈board"

### 4. Using the Board

- **Click on topic headers** to collapse/expand sections
- **Click on the source note badge** to open the note at that specific line
- **Click the × button** to remove an item from the board
- **Click the refresh button** to manually update the board

### 5. Uncategorized Items

If a line has only `#😒` but no other topic tags, it will appear in the "未分类" (Uncategorized) section.

## Examples

### Work Frustration
```markdown
#😒 The meeting could have been an email - wasted 2 hours today #work #timemanagement
```
Shows: "The meeting could have been an email - wasted 2 hours today" under #work and #timemanagement

### Technical Debt
```markdown
#😒 This legacy code needs serious refactoring. The architecture is a mess. #coding #tech-debt
```
Shows: "This legacy code needs serious refactoring. The architecture is a mess." under #coding and #tech-debt

### Process Improvement
```markdown
The current onboarding process is confusing for new team members #😒 #process #team
```
Shows: "The current onboarding process is confusing for new team members" under #process and #team

### Personal Development
```markdown
#😒 Still struggling with time management - need to find a better system #productivity #self-improvement
```
Shows: "Still struggling with time management - need to find a better system" under #productivity and #self-improvement

## Settings

The 😒 负反馈board shares settings with the task board and ❤️ 正反馈board:
- **Excluded tags**: Tags to ignore when organizing
- **Excluded folders**: Folders to skip when scanning
- **Show source note**: Display note metadata
- **Topic sort order**: How to sort topic sections (alphabetical or by count)

## Use Cases

The 负反馈board is useful for:
- **Tracking frustrations**: Document what's bothering you to address later
- **Identifying patterns**: See recurring issues across different areas
- **Action items**: Convert negative feedback into improvement opportunities
- **Venting**: Get it out of your system in an organized way
- **Process improvement**: Track inefficiencies and areas needing optimization
- **Learning from mistakes**: Document what went wrong and why

## Notes

- The board automatically scans all markdown files in your vault, line by line
- Removing the `#😒` tag from a line will remove it from the board
- The board updates automatically when you create, modify, or delete notes
- Each line with a trigger tag is treated as a separate feedback item
- Task checkbox lines (starting with `- [ ]` or `- [x]`) are NOT scanned for feedback tags

## Comparison with ❤️ 正反馈board

| Feature | ❤️ 正反馈board | 😒 负反馈board |
|---------|------------------------|----------------------|
| **Purpose** | Track wins and successes | Track frustrations and areas for improvement |
| **Trigger Tags** | `#正反馈` or `#❤️` | `#😒` |
| **Use Case** | Gratitude, achievements | Problems, inefficiencies |
| **Mindset** | Reinforcement | Action-oriented improvement |

Both boards help you build self-awareness: the ❤️ 正反馈board reminds you of what's working well, while the 😒 负反馈board helps you identify and address what needs attention.
