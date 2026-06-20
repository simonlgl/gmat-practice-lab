import type { Difficulty, Question, QuestionType, SectionId } from "./types";

type DraftQuestion = Omit<Question, "id" | "source" | "estimatedTimeSeconds"> & {
  estimatedTimeSeconds?: number;
};

const sectionPrefix: Record<SectionId, string> = {
  quant: "Q",
  verbal: "V",
  data: "D",
};

function q(section: SectionId, index: number, draft: DraftQuestion): Question {
  return {
    ...draft,
    id: `${sectionPrefix[section]}-${String(index).padStart(3, "0")}`,
    source: "starter",
    estimatedTimeSeconds:
      draft.estimatedTimeSeconds ??
      (section === "data" ? 135 : section === "verbal" ? 115 : 105),
  };
}

function standardDataSufficiencyChoices() {
  return [
    "Statement (1) alone is sufficient, but statement (2) alone is not sufficient.",
    "Statement (2) alone is sufficient, but statement (1) alone is not sufficient.",
    "Both statements together are sufficient, but neither statement alone is sufficient.",
    "Each statement alone is sufficient.",
    "Statements (1) and (2) together are not sufficient.",
  ];
}

const quantQuestions: DraftQuestion[] = [
  {
    section: "quant",
    type: "Problem Solving",
    topic: "Ratios",
    difficulty: 1,
    prompt:
      "A consulting team split a $500 travel budget between rail and hotel costs in a ratio of 2 to 3. How many dollars were spent on hotel costs?",
    choices: ["$180", "$200", "$250", "$300", "$320"],
    correctChoice: 3,
    explanation:
      "The total ratio has 5 parts. Hotel costs are 3 parts, so 3/5 of $500 is $300.",
    tags: ["ratios", "arithmetic"],
  },
  {
    section: "quant",
    type: "Problem Solving",
    topic: "Percents",
    difficulty: 1,
    prompt:
      "A license that normally costs $80 is discounted by 15% and then charged a 10% service fee on the discounted price. What is the final price?",
    choices: ["$68.00", "$70.40", "$72.00", "$74.80", "$88.00"],
    correctChoice: 3,
    explanation:
      "After the discount, the price is 80 x 0.85 = 68. The service fee makes it 68 x 1.10 = 74.80.",
    tags: ["percents", "arithmetic"],
  },
  {
    section: "quant",
    type: "Problem Solving",
    topic: "Linear Equations",
    difficulty: 1,
    prompt: "If 3x + 7 = 31, what is the value of x?",
    choices: ["6", "7", "8", "9", "10"],
    correctChoice: 2,
    explanation: "Subtract 7 from both sides to get 3x = 24, so x = 8.",
    tags: ["algebra"],
  },
  {
    section: "quant",
    type: "Problem Solving",
    topic: "Averages",
    difficulty: 1,
    prompt:
      "The average of five values is 18. If four of the values have a sum of 70, what is the fifth value?",
    choices: ["16", "18", "20", "22", "24"],
    correctChoice: 2,
    explanation:
      "The five values sum to 5 x 18 = 90. The fifth value is 90 - 70 = 20.",
    tags: ["averages"],
  },
  {
    section: "quant",
    type: "Problem Solving",
    topic: "Work Rates",
    difficulty: 2,
    prompt:
      "Machine A can complete a batch in 6 hours, and Machine B can complete the same batch in 3 hours. Working together, how many hours do they need to complete one batch?",
    choices: ["1", "1.5", "2", "2.5", "3"],
    correctChoice: 2,
    explanation:
      "Their combined rate is 1/6 + 1/3 = 1/2 batch per hour, so one batch takes 2 hours.",
    tags: ["rates", "work"],
  },
  {
    section: "quant",
    type: "Problem Solving",
    topic: "Probability",
    difficulty: 2,
    prompt:
      "A box contains 4 red pens and 6 blue pens. If two pens are selected without replacement, what is the probability that the first is red and the second is blue?",
    choices: ["2/15", "4/15", "1/3", "3/10", "2/5"],
    correctChoice: 1,
    explanation:
      "The probability is (4/10) x (6/9) = 24/90 = 4/15.",
    tags: ["probability"],
  },
  {
    section: "quant",
    type: "Problem Solving",
    topic: "Average Speed",
    difficulty: 2,
    prompt:
      "A driver traveled the first 120 miles of a 240-mile trip at 40 mph and the last 120 miles at 80 mph. What was the driver's average speed for the whole trip?",
    choices: ["48 mph", "50 mph", "53 1/3 mph", "60 mph", "64 mph"],
    correctChoice: 2,
    explanation:
      "The trip took 120/40 + 120/80 = 3 + 1.5 = 4.5 hours. The average speed is 240/4.5 = 53 1/3 mph.",
    tags: ["rates", "weighted average"],
  },
  {
    section: "quant",
    type: "Problem Solving",
    topic: "Profit",
    difficulty: 2,
    prompt:
      "An item costs a store $120 and sells for $150. The profit is what percent of the selling price?",
    choices: ["15%", "20%", "25%", "30%", "80%"],
    correctChoice: 1,
    explanation:
      "Profit is 150 - 120 = 30. As a percent of selling price, 30/150 = 20%.",
    tags: ["percents", "profit"],
  },
  {
    section: "quant",
    type: "Problem Solving",
    topic: "Sequences",
    difficulty: 2,
    prompt: "For the sequence defined by a_n = 3n + 2, what is a_12?",
    choices: ["32", "35", "38", "41", "44"],
    correctChoice: 2,
    explanation: "Substitute n = 12: 3(12) + 2 = 38.",
    tags: ["sequences", "algebra"],
  },
  {
    section: "quant",
    type: "Problem Solving",
    topic: "Mixtures",
    difficulty: 3,
    prompt:
      "How many liters of a 50% saline solution must be added to 10 liters of a 20% saline solution to obtain a 30% saline solution?",
    choices: ["2", "4", "5", "8", "10"],
    correctChoice: 2,
    explanation:
      "Let x be the liters added. Then (2 + 0.50x)/(10 + x) = 0.30. Solving gives x = 5.",
    tags: ["mixtures", "algebra"],
  },
  {
    section: "quant",
    type: "Problem Solving",
    topic: "Inequalities",
    difficulty: 3,
    prompt: "Which of the following describes all values of x such that 2x - 5 < 9?",
    choices: ["x < 2", "x < 7", "x > 7", "x < 14", "x > -2"],
    correctChoice: 1,
    explanation: "2x - 5 < 9 means 2x < 14, so x < 7.",
    tags: ["inequalities"],
  },
  {
    section: "quant",
    type: "Problem Solving",
    topic: "Geometry",
    difficulty: 3,
    prompt:
      "A rectangle has a perimeter of 54. Its length is 3 more than twice its width. What is the area of the rectangle?",
    choices: ["108", "126", "144", "152", "171"],
    correctChoice: 3,
    explanation:
      "Let width be w and length be 2w + 3. Then 2(w + 2w + 3) = 54, so w = 8 and length = 19. Area is 152.",
    tags: ["geometry", "algebra"],
  },
  {
    section: "quant",
    type: "Problem Solving",
    topic: "Interest",
    difficulty: 3,
    prompt:
      "A deposit of $1,500 earns simple annual interest at 4% for 3 years. How much interest is earned?",
    choices: ["$60", "$120", "$180", "$195", "$240"],
    correctChoice: 2,
    explanation: "Simple interest is principal x rate x time = 1500 x 0.04 x 3 = 180.",
    tags: ["interest", "percents"],
  },
  {
    section: "quant",
    type: "Problem Solving",
    topic: "Statistics",
    difficulty: 3,
    prompt:
      "If 18 is added to the set {12, 14, 16, 20, 22}, what is the median of the new set?",
    choices: ["16", "17", "18", "19", "20"],
    correctChoice: 1,
    explanation:
      "The ordered set is 12, 14, 16, 18, 20, 22. The median is the average of 16 and 18, which is 17.",
    tags: ["statistics"],
  },
  {
    section: "quant",
    type: "Problem Solving",
    topic: "Exponents",
    difficulty: 3,
    prompt: "What is the value of (2^5 x 2^3) / 2^4?",
    choices: ["4", "8", "12", "16", "32"],
    correctChoice: 3,
    explanation: "Combine exponents: 2^(5+3-4) = 2^4 = 16.",
    tags: ["exponents"],
  },
  {
    section: "quant",
    type: "Problem Solving",
    topic: "Sets",
    difficulty: 4,
    prompt:
      "In a class of 60 students, 35 study economics, 28 study finance, and 12 study both. How many students study neither economics nor finance?",
    choices: ["7", "9", "11", "12", "15"],
    correctChoice: 1,
    explanation:
      "Students studying at least one are 35 + 28 - 12 = 51, so 60 - 51 = 9 study neither.",
    tags: ["sets"],
  },
  {
    section: "quant",
    type: "Problem Solving",
    topic: "Weighted Averages",
    difficulty: 4,
    prompt:
      "A manager bought 4 subscriptions at $12 each and 6 subscriptions at $17 each. What was the average price per subscription?",
    choices: ["$14.00", "$14.50", "$15.00", "$15.25", "$15.50"],
    correctChoice: 2,
    explanation:
      "The total cost is 4(12) + 6(17) = 150 for 10 subscriptions, so the average is $15.",
    tags: ["averages"],
  },
  {
    section: "quant",
    type: "Problem Solving",
    topic: "Rates",
    difficulty: 4,
    prompt:
      "A pump fills a tank in 30 minutes. A drain empties the full tank in 45 minutes. If both are open when the tank is empty, how many minutes will it take to fill the tank?",
    choices: ["45", "60", "75", "90", "120"],
    correctChoice: 3,
    explanation:
      "The net filling rate is 1/30 - 1/45 = 1/90 tank per minute, so the tank fills in 90 minutes.",
    tags: ["rates", "work"],
  },
  {
    section: "quant",
    type: "Problem Solving",
    topic: "Percents",
    difficulty: 4,
    prompt:
      "A quantity is increased by 20% and then decreased by 25%. The final quantity is what percent of the original?",
    choices: ["85%", "90%", "95%", "100%", "105%"],
    correctChoice: 1,
    explanation: "The multiplier is 1.20 x 0.75 = 0.90, so the final quantity is 90%.",
    tags: ["percents"],
  },
  {
    section: "quant",
    type: "Problem Solving",
    topic: "Coordinate Geometry",
    difficulty: 5,
    prompt: "What is the slope of the line passing through (2, 5) and (6, 13)?",
    choices: ["1", "3/2", "2", "5/2", "4"],
    correctChoice: 2,
    explanation: "Slope is (13 - 5)/(6 - 2) = 8/4 = 2.",
    tags: ["coordinate geometry"],
  },
  {
    section: "quant",
    type: "Problem Solving",
    topic: "Number Properties",
    difficulty: 5,
    prompt:
      "What is the least positive multiple of both 12 and 18 that is greater than 100?",
    choices: ["102", "108", "120", "126", "144"],
    correctChoice: 1,
    explanation:
      "The least common multiple of 12 and 18 is 36. Multiples of 36 greater than 100 begin with 108.",
    tags: ["number properties"],
  },
];

const verbalQuestions: DraftQuestion[] = [
  {
    section: "verbal",
    type: "Critical Reasoning",
    topic: "Strengthen",
    difficulty: 1,
    prompt:
      "A cafe introduced mobile ordering and then saw weekday revenue increase by 8%. The owner concluded that mobile ordering caused the increase. Which statement most strengthens the conclusion?",
    choices: [
      "Several nearby cafes also use mobile ordering.",
      "The cafe did not change prices, menu items, hours, or advertising during the period.",
      "Weekend revenue at the cafe was unchanged.",
      "Some customers still prefer ordering at the counter.",
      "The cafe's app was designed by a local agency.",
    ],
    correctChoice: 1,
    explanation:
      "If no other major conditions changed, mobile ordering becomes a more plausible cause of the revenue increase.",
    tags: ["causation", "strengthen"],
  },
  {
    section: "verbal",
    type: "Critical Reasoning",
    topic: "Weaken",
    difficulty: 1,
    prompt:
      "A retailer claims its new checkout layout reduced wait times because wait times fell in the first week after the layout changed. Which statement most weakens the claim?",
    choices: [
      "The new layout uses fewer signs than the old layout.",
      "The first week after the change had unusually low customer traffic.",
      "Some employees prefer the old layout.",
      "The retailer plans to update its website next month.",
      "Wait times are measured in minutes.",
    ],
    correctChoice: 1,
    explanation:
      "Lower traffic gives another reason wait times fell, weakening the claim about the layout.",
    tags: ["causation", "weaken"],
  },
  {
    section: "verbal",
    type: "Critical Reasoning",
    topic: "Assumption",
    difficulty: 2,
    prompt:
      "A software firm will reduce support tickets by publishing more tutorials. The plan assumes which of the following?",
    choices: [
      "All customers prefer video tutorials to written guides.",
      "A meaningful share of support tickets comes from issues tutorials can address.",
      "Support agents are paid hourly.",
      "The firm has never published tutorials before.",
      "Customers rarely contact support by phone.",
    ],
    correctChoice: 1,
    explanation:
      "If tickets are not caused by tutorial-addressable issues, publishing tutorials would not reduce them.",
    tags: ["assumption"],
  },
  {
    section: "verbal",
    type: "Critical Reasoning",
    topic: "Inference",
    difficulty: 2,
    prompt:
      "Mira is an analyst on Team X. Every analyst on Team X has completed the forecasting course. Some analysts who completed the forecasting course are certified in Python. Which conclusion must be true?",
    choices: [
      "Every analyst on Team X is certified in Python.",
      "No analyst outside Team X completed the forecasting course.",
      "Mira completed the forecasting course.",
      "Some analysts on Team X are not certified in Python.",
      "Every certified Python user completed the forecasting course.",
    ],
    correctChoice: 2,
    explanation:
      "Mira is on Team X, and every analyst on Team X completed the course.",
    tags: ["inference", "logic"],
  },
  {
    section: "verbal",
    type: "Critical Reasoning",
    topic: "Explain",
    difficulty: 2,
    prompt:
      "After a company shortened meetings from 60 minutes to 30 minutes, employees reported feeling less rushed, even though they had more meetings per week. Which statement best explains this result?",
    choices: [
      "The company also required each meeting to have a written agenda and a single decision owner.",
      "The company sells project-management software.",
      "Employees had previously attended meetings in several rooms.",
      "Some employees dislike morning meetings.",
      "The number of employees did not change.",
    ],
    correctChoice: 0,
    explanation:
      "Better structure can make shorter, more frequent meetings feel less rushed.",
    tags: ["explain"],
  },
  {
    section: "verbal",
    type: "Critical Reasoning",
    topic: "Evaluate",
    difficulty: 3,
    prompt:
      "A city plans to reduce bus fares to increase total fare revenue. Which question is most useful for evaluating the plan?",
    choices: [
      "How many bus routes have names rather than numbers?",
      "Will the lower fare increase ridership enough to offset the lower revenue per ride?",
      "Do most buses have digital displays?",
      "How many city residents own bicycles?",
      "Will the city repaint bus stops next year?",
    ],
    correctChoice: 1,
    explanation:
      "The plan depends on whether volume gains can exceed the loss per ride.",
    tags: ["evaluate", "revenue"],
  },
  {
    section: "verbal",
    type: "Critical Reasoning",
    topic: "Flaw",
    difficulty: 3,
    prompt:
      "A director argues: 'Our pilot training program was followed by higher sales, so the program must be rolled out companywide.' The reasoning is most vulnerable because it",
    choices: [
      "treats a possible correlation as proof of causation.",
      "uses a percentage without a base number.",
      "confuses profit with revenue.",
      "compares two companies in different industries.",
      "assumes sales cannot be measured.",
    ],
    correctChoice: 0,
    explanation:
      "The argument assumes the program caused higher sales without ruling out other causes.",
    tags: ["flaw", "causation"],
  },
  {
    section: "verbal",
    type: "Critical Reasoning",
    topic: "Boldface",
    difficulty: 3,
    prompt:
      "A report says: 'The market for compact delivery vans is growing. However, battery prices remain volatile. Therefore, manufacturers should delay large electric-van investments.' The role of the second sentence is to",
    choices: [
      "state the report's main conclusion.",
      "present evidence that qualifies the appeal of an investment.",
      "summarize an opposing conclusion.",
      "define a term used in the conclusion.",
      "reject the possibility of market growth.",
    ],
    correctChoice: 1,
    explanation:
      "Battery-price volatility is evidence used to qualify the opportunity created by market growth.",
    tags: ["argument structure"],
  },
  {
    section: "verbal",
    type: "Critical Reasoning",
    topic: "Plan",
    difficulty: 4,
    prompt:
      "A manufacturer plans to lower defect rates by giving bonuses to teams with the fewest reported defects. Which statement identifies the most serious potential weakness in the plan?",
    choices: [
      "Teams may underreport defects to earn bonuses.",
      "Some defects are easier to repair than others.",
      "Bonuses are paid quarterly.",
      "The manufacturer sells several products.",
      "Some employees prefer public recognition.",
    ],
    correctChoice: 0,
    explanation:
      "If incentives reduce reporting rather than defects, the plan fails at its stated goal.",
    tags: ["plan", "weaken"],
  },
  {
    section: "verbal",
    type: "Critical Reasoning",
    topic: "Assumption",
    difficulty: 4,
    prompt:
      "A university will improve graduation rates by requiring first-year students to meet monthly with advisors. The argument assumes that",
    choices: [
      "students who currently graduate never meet advisors.",
      "advisor meetings can address at least one significant cause of delayed graduation.",
      "monthly meetings are less useful than weekly meetings.",
      "all advisors teach first-year seminars.",
      "graduation rates are already above the national average.",
    ],
    correctChoice: 1,
    explanation:
      "The policy can improve graduation only if advising affects a meaningful cause of the problem.",
    tags: ["assumption"],
  },
  {
    section: "verbal",
    type: "Critical Reasoning",
    topic: "Resolve",
    difficulty: 4,
    prompt:
      "A gym introduced a cheaper afternoon membership. Total memberships increased, but total monthly revenue fell. Which statement best resolves the apparent discrepancy?",
    choices: [
      "Many existing full-price members switched to the cheaper afternoon membership.",
      "The gym replaced several treadmills.",
      "Afternoon classes are shorter than evening classes.",
      "Some new members joined online.",
      "The gym is located near two office buildings.",
    ],
    correctChoice: 0,
    explanation:
      "New memberships can rise while revenue falls if enough existing members downgrade.",
    tags: ["resolve", "revenue"],
  },
  {
    section: "verbal",
    type: "Critical Reasoning",
    topic: "Parallel Reasoning",
    difficulty: 5,
    prompt:
      "A team argues that because a product succeeded after a price cut, every product should receive a price cut. Which argument uses the most similar flawed reasoning?",
    choices: [
      "A store opened earlier and had more morning sales, so opening earlier may help stores with morning demand.",
      "A newsletter gained readers after adding interviews, so all newsletters, regardless of audience, should add interviews.",
      "A warehouse reduced errors after adding scans, so scan data should be reviewed.",
      "A bank shortened forms and saw fewer abandoned applications, so the forms should remain short.",
      "A restaurant sold more soup on cold days, so weather affects soup demand.",
    ],
    correctChoice: 1,
    explanation:
      "Both arguments overgeneralize from one successful case to all cases without considering relevant differences.",
    tags: ["parallel reasoning", "flaw"],
  },
  {
    section: "verbal",
    type: "Critical Reasoning",
    topic: "Inference",
    difficulty: 5,
    prompt:
      "No vendor approved for critical systems lacks encrypted backups. Some vendors with encrypted backups are not approved for critical systems. Which conclusion follows?",
    choices: [
      "Every vendor with encrypted backups is approved for critical systems.",
      "At least one vendor with encrypted backups is not approved for critical systems.",
      "No approved vendor has encrypted backups.",
      "Some approved vendors lack encrypted backups.",
      "Every vendor not approved lacks encrypted backups.",
    ],
    correctChoice: 1,
    explanation:
      "The second sentence directly states that some vendors with encrypted backups are not approved.",
    tags: ["logic", "inference"],
  },
];

const rcPassageA =
  "Regional food distributors increasingly rely on predictive ordering systems that estimate demand for perishable products. The promise of these systems is not simply that they reduce waste, but that they let distributors shift inventory among stores before shortages become visible. Yet the systems perform poorly when local events, weather shifts, or sudden supplier disruptions make historical patterns less relevant. Managers who treat predictions as instructions often fare worse than managers who treat predictions as prompts for further review.";

const rcPassageB =
  "In many firms, data dashboards were first adopted as reporting tools: they translated completed activity into charts for managers. More recently, dashboards have become operational interfaces, guiding daily decisions about staffing, pricing, and inventory. This shift has made dashboard design more consequential. A display that emphasizes a convenient metric can steer attention away from a more meaningful but less visible constraint. The best dashboards therefore make uncertainty and trade-offs visible, not merely performance.";

const readingQuestions: DraftQuestion[] = [
  {
    section: "verbal",
    type: "Reading Comprehension",
    topic: "Main Idea",
    difficulty: 2,
    stimulus: rcPassageA,
    prompt: "The passage is primarily concerned with",
    choices: [
      "arguing that predictive ordering systems should be banned.",
      "explaining both the promise and limits of predictive ordering systems.",
      "showing that local events are more important than inventory data.",
      "comparing food distributors with retailers in other industries.",
      "describing the history of perishable-food logistics.",
    ],
    correctChoice: 1,
    explanation:
      "The passage presents benefits of prediction and then explains situations in which predictions can mislead.",
    tags: ["main idea"],
  },
  {
    section: "verbal",
    type: "Reading Comprehension",
    topic: "Inference",
    difficulty: 3,
    stimulus: rcPassageA,
    prompt:
      "The passage suggests that predictive ordering systems are most useful when managers",
    choices: [
      "ignore historical patterns.",
      "use predictions as one input in a broader decision process.",
      "order the same amount of every product each day.",
      "centralize every inventory decision.",
      "avoid shifting inventory among stores.",
    ],
    correctChoice: 1,
    explanation:
      "The final sentence contrasts managers who follow predictions blindly with those who review them critically.",
    tags: ["inference"],
  },
  {
    section: "verbal",
    type: "Reading Comprehension",
    topic: "Detail",
    difficulty: 2,
    stimulus: rcPassageA,
    prompt:
      "According to the passage, which factor can make historical patterns less relevant?",
    choices: [
      "The use of fewer stores",
      "Sudden supplier disruptions",
      "Lower food prices",
      "Longer product shelf lives",
      "Managerial training programs",
    ],
    correctChoice: 1,
    explanation:
      "The passage specifically names local events, weather shifts, and sudden supplier disruptions.",
    tags: ["detail"],
  },
  {
    section: "verbal",
    type: "Reading Comprehension",
    topic: "Function",
    difficulty: 4,
    stimulus: rcPassageA,
    prompt:
      "The last sentence functions mainly to",
    choices: [
      "reject the use of prediction in inventory management.",
      "distinguish two ways managers can respond to predictive outputs.",
      "introduce a new industry unrelated to food distribution.",
      "summarize the mathematical design of ordering systems.",
      "claim that managers should replace predictive systems.",
    ],
    correctChoice: 1,
    explanation:
      "It contrasts treating predictions as instructions with treating them as prompts for review.",
    tags: ["function"],
  },
  {
    section: "verbal",
    type: "Reading Comprehension",
    topic: "Application",
    difficulty: 4,
    stimulus: rcPassageA,
    prompt:
      "Which action would best reflect the author's view of predictive ordering systems?",
    choices: [
      "Automatically accept all system-generated orders.",
      "Disable predictions whenever demand changes.",
      "Review predictions alongside event calendars and supplier updates.",
      "Use only last year's sales data.",
      "Let stores operate without inventory transfers.",
    ],
    correctChoice: 2,
    explanation:
      "The author favors using predictions critically with awareness of conditions that can disrupt patterns.",
    tags: ["application"],
  },
  {
    section: "verbal",
    type: "Reading Comprehension",
    topic: "Main Idea",
    difficulty: 2,
    stimulus: rcPassageB,
    prompt: "The passage mainly argues that dashboards",
    choices: [
      "should be used only after activity is complete.",
      "are less useful than traditional reports.",
      "have become decision tools whose design can shape behavior.",
      "should hide uncertainty to keep managers focused.",
      "are effective only for staffing decisions.",
    ],
    correctChoice: 2,
    explanation:
      "The passage describes a shift from reporting to operational decision-making and emphasizes design consequences.",
    tags: ["main idea"],
  },
  {
    section: "verbal",
    type: "Reading Comprehension",
    topic: "Inference",
    difficulty: 3,
    stimulus: rcPassageB,
    prompt:
      "The author would most likely agree that a dashboard metric can be harmful if it",
    choices: [
      "is updated frequently.",
      "is shown in chart form.",
      "draws attention away from a more important constraint.",
      "is used by employees rather than managers.",
      "summarizes more than one day of activity.",
    ],
    correctChoice: 2,
    explanation:
      "The passage says convenient metrics can steer attention away from more meaningful constraints.",
    tags: ["inference"],
  },
  {
    section: "verbal",
    type: "Reading Comprehension",
    topic: "Detail",
    difficulty: 3,
    stimulus: rcPassageB,
    prompt:
      "The passage states that dashboards were first adopted mainly as",
    choices: [
      "pricing engines.",
      "reporting tools.",
      "staffing substitutes.",
      "forecasting competitions.",
      "inventory warehouses.",
    ],
    correctChoice: 1,
    explanation:
      "The first sentence says dashboards were first adopted as reporting tools.",
    tags: ["detail"],
  },
  {
    section: "verbal",
    type: "Reading Comprehension",
    topic: "Function",
    difficulty: 4,
    stimulus: rcPassageB,
    prompt:
      "The phrase 'not merely performance' most directly supports the idea that dashboards should",
    choices: [
      "avoid all performance data.",
      "replace managerial judgment.",
      "show uncertainty and trade-offs in addition to results.",
      "use fewer visual elements.",
      "measure only financial outcomes.",
    ],
    correctChoice: 2,
    explanation:
      "The passage says the best dashboards make uncertainty and trade-offs visible, not just performance.",
    tags: ["function"],
  },
  {
    section: "verbal",
    type: "Reading Comprehension",
    topic: "Application",
    difficulty: 5,
    stimulus: rcPassageB,
    prompt:
      "Which dashboard design would best align with the passage's recommendation?",
    choices: [
      "A dashboard that ranks stores only by sales volume.",
      "A dashboard that hides missing data to reduce clutter.",
      "A dashboard that shows profit, stock limits, and confidence ranges together.",
      "A dashboard that reports last month's activity once per quarter.",
      "A dashboard that uses a single color for every status.",
    ],
    correctChoice: 2,
    explanation:
      "Showing performance, constraints, and uncertainty together matches the author's recommendation.",
    tags: ["application"],
  },
];

const dataQuestions: DraftQuestion[] = [
  {
    section: "data",
    type: "Data Sufficiency",
    topic: "Percents",
    difficulty: 1,
    prompt:
      "What was the total revenue from Product X last month?\n\n(1) Product X sold 400 units last month.\n(2) The average selling price of Product X last month was $25.",
    choices: standardDataSufficiencyChoices(),
    correctChoice: 2,
    explanation:
      "Units and average price together determine revenue. Neither statement alone is enough.",
    tags: ["data sufficiency", "revenue"],
  },
  {
    section: "data",
    type: "Data Sufficiency",
    topic: "Ratios",
    difficulty: 2,
    prompt:
      "What is the value of a?\n\n(1) a:b = 3:5.\n(2) b = 20.",
    choices: standardDataSufficiencyChoices(),
    correctChoice: 2,
    explanation:
      "The ratio alone does not give a value, and b alone does not connect to a. Together, a = 12.",
    tags: ["data sufficiency", "ratios"],
  },
  {
    section: "data",
    type: "Data Sufficiency",
    topic: "Averages",
    difficulty: 2,
    prompt:
      "Is the average of x, y, and z greater than 10?\n\n(1) x + y + z = 36.\n(2) x, y, and z are all positive.",
    choices: standardDataSufficiencyChoices(),
    correctChoice: 0,
    explanation:
      "Statement (1) gives an average of 12, so the answer is yes. Statement (2) alone is not enough.",
    tags: ["data sufficiency", "averages"],
  },
  {
    section: "data",
    type: "Data Sufficiency",
    topic: "Number Properties",
    difficulty: 3,
    prompt:
      "Is integer n even?\n\n(1) n is divisible by 6.\n(2) n is divisible by 3.",
    choices: standardDataSufficiencyChoices(),
    correctChoice: 0,
    explanation:
      "A number divisible by 6 is even. A number divisible by 3 can be odd or even.",
    tags: ["data sufficiency", "number properties"],
  },
  {
    section: "data",
    type: "Data Sufficiency",
    topic: "Geometry",
    difficulty: 3,
    prompt:
      "What is the area of rectangle R?\n\n(1) The perimeter of R is 40.\n(2) The length of R is 12.",
    choices: standardDataSufficiencyChoices(),
    correctChoice: 2,
    explanation:
      "Perimeter alone is not enough; length alone is not enough. Together, 2(12 + width) = 40, so width and area are determined.",
    tags: ["data sufficiency", "geometry"],
  },
  {
    section: "data",
    type: "Data Sufficiency",
    topic: "Inequalities",
    difficulty: 4,
    prompt:
      "Is x greater than y?\n\n(1) x - y > 0.\n(2) x + y > 0.",
    choices: standardDataSufficiencyChoices(),
    correctChoice: 0,
    explanation:
      "Statement (1) directly means x > y. Statement (2) does not compare x and y.",
    tags: ["data sufficiency", "inequalities"],
  },
  {
    section: "data",
    type: "Data Sufficiency",
    topic: "Functions",
    difficulty: 4,
    prompt:
      "For linear function f, what is f(4)?\n\n(1) f(1) = 5 and f(3) = 9.\n(2) The slope of f is 2.",
    choices: standardDataSufficiencyChoices(),
    correctChoice: 0,
    explanation:
      "Two points determine the linear function, so statement (1) is sufficient. Slope alone is not sufficient.",
    tags: ["data sufficiency", "functions"],
  },
  {
    section: "data",
    type: "Data Sufficiency",
    topic: "Absolute Value",
    difficulty: 5,
    prompt:
      "What is the value of x?\n\n(1) |x| = 7.\n(2) x < 0.",
    choices: standardDataSufficiencyChoices(),
    correctChoice: 2,
    explanation:
      "Statement (1) leaves x as 7 or -7, and statement (2) alone gives no value. Together, x = -7.",
    tags: ["data sufficiency", "absolute value"],
  },
  {
    section: "data",
    type: "Table Analysis",
    topic: "Operations",
    difficulty: 2,
    prompt:
      "Based on the table, which region had the highest revenue per employee?",
    table: {
      caption: "Quarterly operating data",
      headers: ["Region", "Revenue ($M)", "Employees"],
      rows: [
        ["North", "12", "60"],
        ["South", "9", "30"],
        ["West", "15", "75"],
        ["Central", "10", "40"],
      ],
    },
    choices: ["North", "South", "West", "Central", "North and West tie"],
    correctChoice: 1,
    explanation:
      "Revenue per employee is North 0.20, South 0.30, West 0.20, and Central 0.25 million.",
    tags: ["table analysis", "productivity"],
  },
  {
    section: "data",
    type: "Table Analysis",
    topic: "Percent Change",
    difficulty: 3,
    prompt:
      "Which product had the greatest percent increase in monthly units sold?",
    table: {
      caption: "Monthly units sold",
      headers: ["Product", "April", "May"],
      rows: [
        ["A", "80", "100"],
        ["B", "50", "70"],
        ["C", "120", "144"],
        ["D", "30", "39"],
      ],
    },
    choices: ["A", "B", "C", "D", "A and C tie"],
    correctChoice: 1,
    explanation:
      "Percent increases are A 25%, B 40%, C 20%, and D 30%.",
    tags: ["table analysis", "percents"],
  },
  {
    section: "data",
    type: "Table Analysis",
    topic: "Weighted Averages",
    difficulty: 4,
    prompt:
      "Using the table, what was the weighted average customer rating across all stores?",
    table: {
      caption: "Store survey results",
      headers: ["Store", "Responses", "Average Rating"],
      rows: [
        ["East", "100", "4.2"],
        ["Lake", "50", "3.8"],
        ["Hill", "150", "4.4"],
      ],
    },
    choices: ["4.10", "4.17", "4.20", "4.25", "4.31"],
    correctChoice: 3,
    explanation:
      "The weighted average is (100(4.2)+50(3.8)+150(4.4))/300 = 4.23, closest to 4.25.",
    tags: ["table analysis", "weighted average"],
  },
  {
    section: "data",
    type: "Table Analysis",
    topic: "Constraints",
    difficulty: 5,
    prompt:
      "If the company can fund only projects with cost under $70k and ROI at least 18%, which projects qualify?",
    table: {
      caption: "Project candidates",
      headers: ["Project", "Cost ($k)", "Expected ROI"],
      rows: [
        ["Alpha", "65", "16%"],
        ["Beta", "72", "21%"],
        ["Core", "58", "18%"],
        ["Delta", "64", "23%"],
      ],
    },
    choices: ["Core only", "Delta only", "Core and Delta", "Alpha and Core", "Beta and Delta"],
    correctChoice: 2,
    explanation:
      "Core and Delta both cost less than $70k and have ROI of at least 18%.",
    tags: ["table analysis", "constraints"],
  },
  {
    section: "data",
    type: "Graphics Interpretation",
    topic: "Charts",
    difficulty: 2,
    prompt:
      "The chart shows monthly leads. From March to April, leads increased by approximately what percent?",
    chart: {
      caption: "Monthly leads",
      unit: "leads",
      bars: [
        { label: "Jan", value: 120 },
        { label: "Feb", value: 150 },
        { label: "Mar", value: 160 },
        { label: "Apr", value: 200 },
      ],
    },
    choices: ["15%", "20%", "25%", "30%", "40%"],
    correctChoice: 2,
    explanation:
      "The increase is 40 on a base of 160, so 40/160 = 25%.",
    tags: ["graphics", "percents"],
  },
  {
    section: "data",
    type: "Graphics Interpretation",
    topic: "Charts",
    difficulty: 3,
    prompt:
      "Which quarter had the largest share of the year's total subscription starts?",
    chart: {
      caption: "Subscription starts by quarter",
      unit: "starts",
      bars: [
        { label: "Q1", value: 450 },
        { label: "Q2", value: 520 },
        { label: "Q3", value: 610 },
        { label: "Q4", value: 590 },
      ],
    },
    choices: ["Q1", "Q2", "Q3", "Q4", "Q3 and Q4 tie"],
    correctChoice: 2,
    explanation:
      "Q3 has the largest value, so it also has the largest share of the annual total.",
    tags: ["graphics"],
  },
  {
    section: "data",
    type: "Graphics Interpretation",
    topic: "Charts",
    difficulty: 4,
    prompt:
      "For the product shown, the target was 500 units each month. In which month was the shortfall greatest?",
    chart: {
      caption: "Monthly units shipped",
      unit: "units",
      bars: [
        { label: "May", value: 470 },
        { label: "Jun", value: 515 },
        { label: "Jul", value: 455 },
        { label: "Aug", value: 490 },
      ],
    },
    choices: ["May", "June", "July", "August", "May and August tie"],
    correctChoice: 2,
    explanation:
      "Shortfalls are May 30, July 45, and August 10. July is greatest.",
    tags: ["graphics", "targets"],
  },
  {
    section: "data",
    type: "Graphics Interpretation",
    topic: "Charts",
    difficulty: 5,
    prompt:
      "If profit equals revenue minus cost, which product had the highest profit?",
    table: {
      caption: "Product economics",
      headers: ["Product", "Revenue", "Cost"],
      rows: [
        ["A", "$90", "$55"],
        ["B", "$110", "$80"],
        ["C", "$75", "$38"],
        ["D", "$120", "$86"],
      ],
    },
    choices: ["A", "B", "C", "D", "A and D tie"],
    correctChoice: 2,
    explanation:
      "Profits are A 35, B 30, C 37, and D 34. Product C is highest.",
    tags: ["graphics", "profit"],
  },
  {
    section: "data",
    type: "Two-Part Analysis",
    topic: "Optimization",
    difficulty: 3,
    prompt:
      "A firm needs exactly 100 ad clicks. Search ads cost $2 per click and social ads cost $1 per click. Search clicks convert at 8%, social clicks convert at 4%. Which mix gives the lowest cost while producing at least 6 expected conversions?",
    choices: [
      "0 search, 100 social",
      "25 search, 75 social",
      "50 search, 50 social",
      "75 search, 25 social",
      "100 search, 0 social",
    ],
    correctChoice: 2,
    explanation:
      "50 search and 50 social yields 4 + 2 = 6 expected conversions at a cost of $150, lower than mixes with more search.",
    tags: ["two-part", "optimization"],
  },
  {
    section: "data",
    type: "Two-Part Analysis",
    topic: "Tradeoffs",
    difficulty: 4,
    prompt:
      "A vendor must choose one warehouse and one carrier. The target is delivery under 4 days at total cost under $9 per order. Which qualifying pair has the lowest cost?",
    table: {
      caption: "Options",
      headers: ["Option", "Cost", "Days"],
      rows: [
        ["Warehouse A", "$3", "1.5"],
        ["Warehouse B", "$2", "2.0"],
        ["Carrier X", "$6", "2.2"],
        ["Carrier Y", "$5", "1.7"],
      ],
    },
    choices: ["A + X", "A + Y", "B + X", "B + Y", "No pair"],
    correctChoice: 3,
    explanation:
      "B + Y costs $7 and takes 3.7 days. The other qualifying time/cost pairs do not beat both targets.",
    tags: ["two-part", "tradeoffs"],
  },
  {
    section: "data",
    type: "Multi-Source Reasoning",
    topic: "Business Cases",
    difficulty: 4,
    stimulus:
      "Memo: A pilot program is considered successful if it reduces processing time by at least 10% without increasing error rate. Operations note: Team Red reduced average time from 50 minutes to 44 minutes. Team Blue reduced average time from 40 minutes to 35 minutes. Quality note: Red's error rate stayed at 2.1%; Blue's rose from 1.8% to 2.4%.",
    prompt: "Which team met the stated success criteria?",
    choices: ["Red only", "Blue only", "Both Red and Blue", "Neither team", "Cannot be determined"],
    correctChoice: 0,
    explanation:
      "Red reduced time by 12% with no error-rate increase. Blue reduced time enough but had a higher error rate.",
    tags: ["multi-source", "criteria"],
  },
  {
    section: "data",
    type: "Multi-Source Reasoning",
    topic: "Business Cases",
    difficulty: 5,
    stimulus:
      "Policy: A supplier receives priority status if it ships at least 95% of orders on time and has fewer than 3 defects per 1,000 units. Logistics file: Supplier M shipped 1,900 of 2,000 orders on time. Supplier N shipped 930 of 960 orders on time. Quality file: Supplier M had 7 defects in 4,000 units. Supplier N had 4 defects in 1,000 units.",
    prompt: "Which supplier receives priority status?",
    choices: ["Supplier M only", "Supplier N only", "Both suppliers", "Neither supplier", "The information is insufficient"],
    correctChoice: 0,
    explanation:
      "M has 95% on-time shipping and 1.75 defects per 1,000. N is above 95% on time but has 4 defects per 1,000.",
    tags: ["multi-source", "rates"],
  },
];

export function createStarterQuestions(): Question[] {
  const verbal = [...verbalQuestions, ...readingQuestions];
  const all = {
    quant: quantQuestions,
    verbal,
    data: dataQuestions,
  };

  return (Object.entries(all) as Array<[SectionId, DraftQuestion[]]>).flatMap(
    ([section, questions]) =>
      questions.map((question, index) => q(section, index + 1, question)),
  );
}

export const QUESTION_TYPES_BY_SECTION: Record<SectionId, QuestionType[]> = {
  quant: ["Problem Solving"],
  verbal: ["Critical Reasoning", "Reading Comprehension"],
  data: [
    "Data Sufficiency",
    "Table Analysis",
    "Graphics Interpretation",
    "Two-Part Analysis",
    "Multi-Source Reasoning",
  ],
};

export const DIFFICULTIES: Difficulty[] = [1, 2, 3, 4, 5];
