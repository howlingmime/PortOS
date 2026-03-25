import * as api from '../../services/api';

export async function applyOrganizationSuggestion(suggestion) {
  let apexId = null;
  // Clone organization array to avoid mutating caller's state
  const organization = suggestion.organization?.map(item => ({ ...item }));

  // Create apex goal if suggested as new
  if (suggestion.apexGoal?.suggestedTitle && !suggestion.apexGoal?.existingId) {
    const apex = await api.createGoal({
      title: suggestion.apexGoal.suggestedTitle,
      description: suggestion.apexGoal.suggestedDescription || '',
      horizon: 'lifetime',
      category: 'legacy',
      goalType: 'apex'
    }).then(res => res, () => null);
    if (!apex?.id) return false;
    apexId = apex.id;
  }

  // Resolve apex ID: prefer existing, fall back to newly created
  if (!apexId && suggestion.apexGoal?.existingId) {
    apexId = suggestion.apexGoal.existingId;
  }

  // Rewrite __new_apex__ placeholders and unparented sub-apex items to resolved apex
  if (apexId && organization) {
    for (const item of organization) {
      if (item.suggestedParentId === '__new_apex__' || (!item.suggestedParentId && item.goalType === 'sub-apex')) {
        item.suggestedParentId = apexId;
      }
    }
  }

  // Create suggested sub-apex goals in parallel, parented under the apex
  if (suggestion.suggestedSubApex?.length) {
    const results = await Promise.all(suggestion.suggestedSubApex.map(sg => {
      const parentId = apexId || (sg.suggestedParentId !== '__new_apex__' ? sg.suggestedParentId : null) || null;
      return api.createGoal({
        title: sg.title,
        description: sg.description || '',
        horizon: 'lifetime',
        category: sg.category || 'legacy',
        goalType: 'sub-apex',
        ...(parentId ? { parentId } : {})
      }).then(() => true, () => false);
    }));
    if (results.some(r => !r)) return false;
  }

  // Apply organization to existing goals
  if (organization?.length) {
    const ok = await api.applyGoalOrganization(organization).then(() => true, () => false);
    if (!ok) return false;
  }

  return true;
}
