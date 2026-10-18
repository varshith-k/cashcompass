--!strict
-- Pure, deterministic Luau: no Roblox services, network, RNG, clocks, or real accounts.
-- All amounts are integer fictional cents. Only RoundService holds writable state.
local Engine = {}

Engine.RULES = table.freeze({
    openingBalance = 250000,
    rent = 120000,
    utilities = 15000,
    groceries = 30000,
    savingsGoal = 40000,
    paycheck = 150000,
    buffer = 30000,
    laptop = 120000,
    roommate = 20000,
    emergency = 45000,
    lateFee = 5000,
})
local R = Engine.RULES

export type Choice = { id: string, label: string, detail: string }
export type Phase = { id: string, day: number, station: string, title: string, body: string, choices: {Choice} }
export type Bill = { name: string, amount: number, dueDay: number, paidDay: number? }
export type State = {
    roundId: number, revision: number, phaseIndex: number, day: number,
    balance: number, savings: number, laptopFund: number, lowestBalance: number,
    income: number, spent: number, finished: boolean, hasLaptop: boolean,
    salaryPaid: boolean, roommatePaid: boolean, pendingLaptop: boolean,
    pendingRent: boolean, pendingEmergency: boolean,
    purchaseChecks: number, safePurchases: number,
    bills: {[string]: Bill}, log: {string},
}

Engine.PHASES = {
    {
        id = "laptop", day = 1, station = "Store", title = "The $1,200 temptation",
        body = "You have $2,500, but rent and groceries arrive before payday on day 15. The shopkeeper offers a laptop. What is actually safe to spend?",
        choices = {
            { id = "buy", label = "Buy the laptop today", detail = "$1,200 now. Only $100 remains after rent, before groceries." },
            { id = "wait", label = "Wait until after payday", detail = "Check again on day 16. Buy only if bills, savings, and the buffer stay covered." },
            { id = "fund", label = "Start a laptop fund", detail = "Set aside $150 now. Keep saving after this month; no laptop purchase yet." },
        },
    },
    {
        id = "rent", day = 5, station = "Apartment", title = "Rent is due",
        body = "Your share of this month's apartment is $1,200. Your roommate's separate $200 debt is not available cash. Payday is still ten days away.",
        choices = {
            { id = "pay", label = "Pay rent today", detail = "$1,200 now. Meet the deadline and avoid a fee." },
            { id = "delay", label = "Arrange a fictional extension", detail = "Pay $1,250 on day 15, including a $50 fee. Counts as a late bill." },
        },
    },
    {
        id = "groceries", day = 8, station = "Store", title = "Stock the kitchen",
        body = "Both baskets cover your food needs for the month. Pick the one that fits your priorities and your upcoming obligations.",
        choices = {
            { id = "budget", label = "The essentials basket", detail = "$300. Covers the month's grocery budget." },
            { id = "premium", label = "The premium basket", detail = "$500. More treats; still the same essential food coverage." },
        },
    },
    {
        id = "roommate", day = 11, station = "Bank", title = "A promise isn't a deposit",
        body = "Your roommate promises to repay $200 tomorrow. Their transfer actually arrives on day 24 in this fixed scenario. A $250 pair of shoes catches your eye.",
        choices = {
            { id = "spend", label = "Buy the shoes on that promise", detail = "Spend $250 of today's cash. The expected $200 is not credited early." },
            { id = "wait", label = "Wait for the actual deposit", detail = "Skip the purchase for now. Count only money that has arrived." },
            { id = "plan", label = "Agree on a later repayment date", detail = "Plan around day 24. This is fictional dialogue, not a real message." },
        },
    },
    {
        id = "emergency", day = 12, station = "Advisor", title = "The unexpected repair",
        body = "Your bike needs a $450 repair so you can get to work. You still have utilities due on day 20. Decide which funds can cover the surprise.",
        choices = {
            { id = "cash", label = "Pay from checking", detail = "$450 now. See how much of your cash cushion remains." },
            { id = "reserve", label = "Use savings first", detail = "Use any goal savings already available, then checking. A laptop fund stays reserved." },
            { id = "delay", label = "Take the repair payment plan", detail = "$500 on day 22, including a $50 fee. Counts as late. Payday posts on day 15." },
        },
    },
    {
        id = "savings", day = 16, station = "Bank", title = "Give future you a share",
        body = "Your $1,500 paycheck has arrived. Any safe deferred laptop purchase has been checked. Utilities cost $150 on day 20; the roommate pays on day 24.",
        choices = {
            { id = "goal", label = "Fund the $400 savings goal", detail = "Transfer $400 from checking, even if it leaves less room for upcoming costs." },
            { id = "half", label = "Save $200 this month", detail = "Transfer $200 now and keep more cash available." },
            { id = "safe", label = "Save up to $400 safely", detail = "Cover remaining bills and a $300 checking buffer first. Save what fits, capped at $400." },
        },
    },
    {
        id = "review", day = 30, station = "Advisor", title = "You made it to day 30",
        body = "Utilities and any deferred payments have posted. The roommate's real $200 deposit arrived on day 24. Review the choices that shaped your month.",
        choices = {{ id = "finish", label = "See my financial-health score", detail = "Review your results and three lessons, then try a different path." }},
    },
} :: {Phase}

local function note(state: State, message: string)
    table.insert(state.log, string.format("Day %d: %s", state.day, message))
end

local function trackLow(state: State)
    state.lowestBalance = math.min(state.lowestBalance, state.balance)
end

local function spend(state: State, amount: number, message: string)
    state.balance -= amount
    state.spent += amount
    trackLow(state)
    note(state, message)
end

local function payBill(state: State, id: string, fee: number)
    local bill = state.bills[id]
    if bill.paidDay ~= nil then return end
    spend(state, bill.amount + fee, bill.name .. " paid" .. (if fee > 0 then " with a $50 fee." else "."))
    bill.paidDay = state.day
end

function Engine.new(roundId: number): State
    return {
        roundId = roundId, revision = 0, phaseIndex = 1, day = 1,
        balance = R.openingBalance, savings = 0, laptopFund = 0, lowestBalance = R.openingBalance,
        income = 0, spent = 0, finished = false, hasLaptop = false,
        salaryPaid = false, roommatePaid = false, pendingLaptop = false,
        pendingRent = false, pendingEmergency = false, purchaseChecks = 0, safePurchases = 0,
        bills = {
            rent = { name = "Rent", amount = R.rent, dueDay = 5 },
            groceries = { name = "Groceries", amount = R.groceries, dueDay = 8 },
            utilities = { name = "Utilities", amount = R.utilities, dueDay = 20 },
            emergency = { name = "Bike repair", amount = R.emergency, dueDay = 12 },
        },
        log = {"Day 1: Your fictional month begins with $2,500."},
    }
end

function Engine.phase(state: State): Phase
    return Engine.PHASES[state.phaseIndex]
end

-- Never include an uncertain incoming roommate payment in safe-to-spend.
function Engine.reservedBills(state: State, horizon: number): number
    local total = 0
    for id, bill in state.bills do
        -- The day-12 surprise is unknown until the emergency challenge.
        local known = id ~= "emergency" or state.phaseIndex >= 5
        if known and bill.paidDay == nil and bill.dueDay <= horizon then
            total += bill.amount
            if (id == "rent" and state.pendingRent) or (id == "emergency" and state.pendingEmergency) then
                total += R.lateFee
            end
        end
    end
    return total
end

function Engine.safeToSpend(state: State): number
    local horizon = if not state.salaryPaid then 14 else 30
    local pendingPurchase = if state.pendingLaptop and horizon >= 16 then R.laptop else 0
    return math.max(0, state.balance - Engine.reservedBills(state, horizon)
        - math.max(0, R.savingsGoal - state.savings) - R.buffer - pendingPurchase)
end

function Engine.outlook(state: State): (number, number)
    local guaranteedIncome = if not state.salaryPaid then R.paycheck else 0
    local pendingPurchase = if state.pendingLaptop then R.laptop else 0
    local conservative = state.balance + guaranteedIncome - Engine.reservedBills(state, 30) - pendingPurchase
    local expected = conservative + (if not state.roommatePaid then R.roommate else 0)
    return conservative, expected
end

local function purchase(state: State, amount: number, description: string)
    state.purchaseChecks += 1
    if amount <= Engine.safeToSpend(state) then state.safePurchases += 1 end
    spend(state, amount, description)
end

local function advance(state: State, targetDay: number)
    for day = state.day + 1, targetDay do
        state.day = day
        if day == 15 and not state.salaryPaid then
            state.balance += R.paycheck
            state.income += R.paycheck
            state.salaryPaid = true
            note(state, "$1,500 paycheck received.")
            if state.pendingRent then
                payBill(state, "rent", R.lateFee)
                state.pendingRent = false
            end
        end
        if day == 16 and state.pendingLaptop then
            state.pendingLaptop = false
            if R.laptop <= Engine.safeToSpend(state) then
                purchase(state, R.laptop, "Deferred laptop bought safely after payday: $1,200.")
                state.hasLaptop = true
            else
                note(state, "Laptop postponed beyond this month: bills, savings, and the buffer come first.")
            end
        end
        if day == 20 then payBill(state, "utilities", 0) end
        if day == 22 and state.pendingEmergency then
            payBill(state, "emergency", R.lateFee)
            state.pendingEmergency = false
        end
        if day == 24 and not state.roommatePaid then
            state.balance += R.roommate
            state.income += R.roommate
            state.roommatePaid = true
            note(state, "$200 roommate repayment actually received.")
        end
    end
end

function Engine.choose(state: State, choiceId: string): (boolean, string?)
    if state.finished then return false, "This round is complete. Choose Play Again." end
    local phase = Engine.phase(state)
    local allowed = false
    for _, choice in phase.choices do
        if choice.id == choiceId then allowed = true; break end
    end
    if not allowed then return false, "That choice is not available for this challenge." end

    if phase.id == "laptop" then
        if choiceId == "buy" then
            purchase(state, R.laptop, "Laptop bought today: $1,200. Rent leaves only $100 before groceries.")
            state.hasLaptop = true
        elseif choiceId == "wait" then
            state.pendingLaptop = true
            note(state, "Laptop will be checked again after payday; no money spent yet.")
        else
            state.balance -= 15000
            state.laptopFund += 15000
            trackLow(state)
            note(state, "$150 set aside in a separate laptop fund, not goal savings.")
        end
    elseif phase.id == "rent" then
        if choiceId == "pay" then payBill(state, "rent", 0)
        else state.pendingRent = true; note(state, "Rent moved to day 15 with a $50 fee.") end
    elseif phase.id == "groceries" then
        state.bills.groceries.amount = if choiceId == "premium" then 50000 else R.groceries
        payBill(state, "groceries", 0)
    elseif phase.id == "roommate" then
        if choiceId == "spend" then purchase(state, 25000, "$250 shoes bought before the roommate's transfer arrived.")
        else note(state, "Roommate's $200 is excluded from available cash until day 24.") end
    elseif phase.id == "emergency" then
        if choiceId == "delay" then
            state.pendingEmergency = true
            note(state, "Repair payment moved to day 22 with a $50 fee.")
        else
            if choiceId == "reserve" then
                local withdrawn = math.min(state.savings, R.emergency)
                state.savings -= withdrawn
                state.balance += withdrawn
                note(state, if withdrawn == 0 then "No goal savings available yet; checking covers the repair." else "Goal savings moved back to checking for the repair.")
            end
            payBill(state, "emergency", 0)
        end
    elseif phase.id == "savings" then
        local amount = if choiceId == "half" then 20000 else R.savingsGoal
        if choiceId == "safe" then
            amount = math.min(R.savingsGoal, math.max(0, state.balance - Engine.reservedBills(state, 30) - R.buffer))
        end
        state.balance -= amount
        state.savings += amount
        trackLow(state)
        note(state, string.format("$%.2f transferred to goal savings.", amount / 100))
    elseif phase.id == "review" then
        state.finished = true
        note(state, "Month complete. Your decisions, not a random outcome, shaped these results.")
    end

    state.revision += 1
    if not state.finished then
        state.phaseIndex += 1
        advance(state, Engine.phase(state).day)
    end
    return true, nil
end

return Engine
