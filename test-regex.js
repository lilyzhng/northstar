const line = "4. #❤️ 今天去了一个 A2UI, AGUI Event, 碰到了一个特别有意思的speaker, 跟他交流了做 benchmark 的想法，希望接下来可以有合作的机会 #coding";

const TAG_REGEX = /#[\w\-\/\u4e00-\u9fa5❤️]+/g;
const matches = line.match(TAG_REGEX);

console.log("Line:", line);
console.log("Matches:", matches);
console.log("Matches (lowercase):", matches ? matches.map(m => m.toLowerCase()) : null);
