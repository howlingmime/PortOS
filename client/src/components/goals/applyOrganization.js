import * as api from '../../services/api';

export async function applyOrganizationSuggestion(suggestion) {
  let apexId = null;

  // Create apex goal if suggested as new
  if (suggestion.apexGoal?.suggestedTitle && !suggestion.apexGoal?.existingId) {
    const apex = await api.createGoal({
      title: suggestion.apexGoal.suggestedTitle,
      description: suggestion.apexGoal.suggestedDescription || '',
      horizon: 'lifetime',
      category: 'legacy',
      goalType: 'apex'
    }).catch(() => null);
    apexId = apex?.id;
    // Rewrite organization items that should parent under new apex
    if (apexId && suggestion.organization) {
      for (const item of suggestion.organization) {
        if (item.suggestedParentId === '__new_apex__' || (!item.suggestedParentId && item.goalType === 'sub-apex')) {
          item.suggestedParentId = apexId;
        }
      }
    }
  }

  // Create suggested sub-apex goals in parallel
  if (suggestion.suggestedSubApex?.length) {
    await Promise.all(suggestion.suggestedSubApex.map(sg =>
      api.createGoal({
        title: sg.title,
        description: sg.description || '',
        horizon: 'lifetime',
        category: sg.category || 'legacy',
        goalType: 'sub-apex'
      }).catch(() => null)
    ));
  }

  // Apply organization to existing goals
  if (suggestion.organization?.length) {
    await api.applyGoalOrganization(suggestion.organization).catch(() => null);
  }
}
