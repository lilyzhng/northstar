const FEEDBACK_TRIGGER_TAGS = ["#正反馈", "#❤️"];
const TAG_REGEX = /#[\w\-\/\u4e00-\u9fa5❤️]+/g;

const line = "4. #❤️ 今天去了一个 A2UI, AGUI Event, 碰到了一个特别有意思的speaker, 跟他交流了做 benchmark 的想法，希望接下来可以有合作的机会 #coding";

function extractTags(text) {
    const matches = text.match(TAG_REGEX);
    return matches ? matches.map((tag) => tag.toLowerCase()) : [];
}

function hasFeedbackTag(line) {
    const tags = extractTags(line);
    console.log("Extracted tags:", tags);
    console.log("Trigger tags:", FEEDBACK_TRIGGER_TAGS.map(t => t.toLowerCase()));
    
    const result = FEEDBACK_TRIGGER_TAGS.some((triggerTag) =>
        tags.includes(triggerTag.toLowerCase())
    );
    console.log("Has feedback tag:", result);
    return result;
}

hasFeedbackTag(line);
