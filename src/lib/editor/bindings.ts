/**
 * Binding suggestions for the inspector. The value is the exact JSON object a
 * prop would store, so the select can round-trip through `JSON.parse`.
 */

import type { Blueprint } from "#lib/schema/blueprint";

export interface BindingChoice {
    group: string;
    value: string;
    label: string;
}

export const bindingChoices = (blueprint: Blueprint): BindingChoice[] => {
    const choices: BindingChoice[] = [];

    for (const input of blueprint.inputs) {
        choices.push({
            group: "Inputs",
            value: JSON.stringify({ var: `inputs.${input.id}` }),
            label: input.label
        });
    }

    for (const name of Object.keys(blueprint.vars)) {
        choices.push({
            group: "Vars",
            value: JSON.stringify({ var: name }),
            label: name
        });
    }

    for (const step of blueprint.steps) {
        for (const [questionId, question] of Object.entries(step.questions)) {
            const base = { step: step.id, question: questionId };
            const label = `${step.id}.${questionId}`;

            choices.push({
                group: "Answers",
                value: JSON.stringify(base),
                label
            });

            if (question.type === "choice") {
                choices.push({
                    group: "Answers",
                    value: JSON.stringify({ ...base, pick: "choice" }),
                    label: `${label} · choice`
                });
            } else if (question.type === "score") {
                choices.push({
                    group: "Answers",
                    value: JSON.stringify({ ...base, pick: "score" }),
                    label: `${label} · score`
                });
            }

            if (question.type !== "noul") {
                choices.push({
                    group: "Answers",
                    value: JSON.stringify({ ...base, pick: "confidence" }),
                    label: `${label} · confidence`
                });
                choices.push({
                    group: "Answers",
                    value: JSON.stringify({ ...base, pick: "probabilities" }),
                    label: `${label} · probabilities`
                });
            }
        }
    }

    return choices;
};
