import { emptyDay } from './rules'

// The money and the books: today's takings, all-time totals, and one summary per past day.
export class Ledger {
  constructor({ money, today = emptyDay(), totals = { guests: 0, lost: 0, earned: 0, bestDay: 0 }, history = [], lastSummary = null }) {
    this.money = money
    this.today = today
    this.totals = totals
    this.history = history // last 30 day summaries
    this.lastSummary = lastSummary
  }

  earn(amount, category) {
    this.money += amount
    this.today.revenue += amount
    this.today[category] += amount
    this.totals.earned += amount
  }

  canAfford(cost) {
    return this.money >= cost
  }

  // Pay the day's bills, file the summary and start a fresh day.
  closeDay(day, rating, wages, upkeep) {
    const expenses = wages + upkeep
    this.money -= expenses
    this.today.expenses = expenses
    const summary = { day, ...this.today, wages, upkeep, profit: this.today.revenue - expenses, rating }
    this.lastSummary = summary
    this.history.push(summary)
    if (this.history.length > 30) this.history.shift()
    this.totals.bestDay = Math.max(this.totals.bestDay, this.today.revenue)
    this.today = emptyDay()
    return summary
  }
}
