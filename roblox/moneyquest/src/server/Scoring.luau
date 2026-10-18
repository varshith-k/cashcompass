--!strict
-- Independent pure scorer. Rules are disclosed to the player in the results.
local Scoring = {}

function Scoring.compute(state: any, rules: any)
    local paid = 0
    local onTime = 0
    local total = 0
    for _, bill in state.bills do
        total += 1
        if bill.paidDay ~= nil then
            paid += 1
            if bill.paidDay <= bill.dueDay then onTime += 1 end
        end
    end
    local components = {
        { label = "Bills paid on time", points = 35 * onTime / total, maximum = 35 },
        { label = "Avoided a negative balance", points = if state.lowestBalance >= 0 then 20 else 0, maximum = 20 },
        { label = "Protected a $300 cash buffer", points = 15 * math.clamp(state.lowestBalance / rules.buffer, 0, 1), maximum = 15 },
        { label = "Progress toward $400 savings", points = 20 * math.clamp(state.savings / rules.savingsGoal, 0, 1), maximum = 20 },
        { label = "Purchases fit safe-to-spend", points = if state.purchaseChecks == 0 then 10 else 10 * state.safePurchases / state.purchaseChecks, maximum = 10 },
    }
    local score = 0
    for _, component in components do score += component.points end
    score = math.clamp(math.floor(score + 0.5), 0, 100)
    local won = state.lowestBalance >= 0 and paid == total and state.balance >= rules.buffer and state.savings >= rules.savingsGoal
    return {
        score = score, won = won, billsPaid = paid, billsOnTime = onTime, totalBills = total,
        title = if won then "Future protected!" elseif state.lowestBalance >= 0 then "Month survived. Room to grow." else "Cash crunch. Try a new plan.",
        components = components,
        lessons = {
            "Account balance is not safe-to-spend: reserve bills, savings, and a cash cushion first.",
            "Timing matters. An affordable purchase after payday can put essentials at risk before it.",
            "A promised repayment is not cash. Plan for delays and rebuild your emergency buffer.",
        },
    }
end

return Scoring
