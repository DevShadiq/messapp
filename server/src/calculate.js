const money = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const mealTotal = (m) => Number(m.breakfast) + Number(m.lunch) + Number(m.dinner) + Number(m.guest);

export function calculateSummary(db, cycleId) {
  const cycle = db.cycles.find((c) => c.id === Number(cycleId));
  if (!cycle) throw Object.assign(new Error('Cycle not found'), { status: 404 });
  const activeIds = db.cycleMembers.filter((x) => x.cycleId === cycle.id && x.active).map((x) => x.memberId);
  const meals = db.meals.filter((x) => x.cycleId === cycle.id && activeIds.includes(x.memberId));
  const totalMeals = meals.reduce((sum, x) => sum + mealTotal(x), 0);
  const totalBazar = db.bazar.filter((x) => x.cycleId === cycle.id).reduce((sum, x) => sum + Number(x.total), 0);
  const costs = db.costs.filter((x) => x.cycleId === cycle.id);
  const equal = costs.filter((x) => x.splitType === 'equal').reduce((s, x) => s + Number(x.amount), 0);
  const mealBased = costs.filter((x) => x.splitType === 'meal_based').reduce((s, x) => s + Number(x.amount), 0);
  const mealRate = totalMeals ? totalBazar / totalMeals : 0;
  const members = activeIds.map((id) => {
    const member = db.members.find((x) => x.id === id);
    const memberMeals = meals.filter((x) => x.memberId === id).reduce((s, x) => s + mealTotal(x), 0);
    const mealCost = memberMeals * mealRate;
    const otherShare = (activeIds.length ? equal / activeIds.length : 0) + (totalMeals ? mealBased * memberMeals / totalMeals : 0);
    const deposit = db.deposits.filter((x) => x.cycleId === cycle.id && x.memberId === id).reduce((s, x) => s + Number(x.amount), 0);
    const openingDue = db.cycleMembers.find((x) => x.cycleId === cycle.id && x.memberId === id)?.openingDue || 0;
    const balance = deposit + openingDue - mealCost - otherShare;
    return { ...member, meals: money(memberMeals), mealCost: money(mealCost), otherShare: money(otherShare), totalCost: money(mealCost + otherShare), deposit: money(deposit), openingDue, balance: money(balance), status: balance > .005 ? 'refund' : balance < -.005 ? 'due' : 'settled' };
  });
  return { cycle: { ...cycle, mealRate: money(mealRate) }, totals: { bazar: money(totalBazar), otherCost: money(equal + mealBased), meals: money(totalMeals), deposits: money(db.deposits.filter((x) => x.cycleId === cycle.id).reduce((s,x) => s + Number(x.amount), 0)) }, members };
}
