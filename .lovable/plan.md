
# Correct Animal Health Heatmap Tooltip Definitions

## Problem

The `HEALTH_STATUS_SEVERITY` definitions in `urgencyGlossary.ts` incorrectly describe the metric as "Mortality or morbidity rate" when the actual calculation is based on **Health Event Prevalence Rate** (number of health events divided by total animals).

## Current vs Correct Definitions

| Level | Current (Incorrect) | Correct |
|-------|---------------------|---------|
| Critical | Mortality or morbidity rate 20% or higher | Health event prevalence rate 20% or higher (number of health events vs total animals) |
| High | Mortality or morbidity rate 10% or higher | Health event prevalence rate 10% or higher |
| Moderate | Mortality or morbidity rate 5% or higher | Health event prevalence rate 5% or higher |
| Low | Mortality or morbidity rate below 5% | Health event prevalence rate below 5% |

## Understanding Prevalence Rate

The prevalence rate shown in the heatmap represents:
```
Prevalence Rate = (Number of Health Events / Total Animals) × 100
```

This measures the **density of health concerns** in a municipality, not specifically deaths (mortality) or diseases (morbidity).

---

## Technical Changes

### File: `src/lib/urgencyGlossary.ts`

Update the `HEALTH_STATUS_SEVERITY` constant (lines 247-288) with corrected descriptions:

**Updated Definitions:**

| Level | Description (English) | Description (Tagalog) |
|-------|----------------------|----------------------|
| Critical | Health event prevalence rate 20% or higher. High density of reported health concerns relative to animal population. | Health event prevalence rate na 20% o higit pa. Mataas na dami ng naiulat na health concerns kumpara sa bilang ng hayop. |
| High | Health event prevalence rate 10% or higher. Elevated health concern activity in the area. | Health event prevalence rate na 10% o higit pa. Mataas na aktibidad ng health concerns sa lugar. |
| Moderate | Health event prevalence rate 5% or higher. Some health concerns present but manageable. | Health event prevalence rate na 5% o higit pa. May mga health concerns pero kayang hawakan. |
| Low | Health event prevalence rate below 5%. Minimal health concerns reported. | Health event prevalence rate na mas mababa sa 5%. Kaunti lamang ang naiulat na health concerns. |

---

## Summary

| Metric | Value |
|--------|-------|
| Files modified | 1 (`urgencyGlossary.ts`) |
| Definitions corrected | 4 (Critical, High, Moderate, Low) |
| Breaking changes | None |
| Impact | Tooltip definitions now accurately describe prevalence rate calculation |
