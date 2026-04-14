# Doc Aga Government Dashboard — User Manual

**Version:** 1.0
**Date:** March 5, 2026
**Audience:** Government livestock officers, regional agricultural coordinators, program managers

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Tab 1: Livestock Analytics](#3-tab-1-livestock-analytics)
4. [Tab 2: Farmer Voice](#4-tab-2-farmer-voice)
5. [Tab 3: Programs & Insights](#5-tab-3-programs--insights)
6. [Filters & Data Controls](#6-filters--data-controls)
7. [Exporting Data](#7-exporting-data)
8. [Glossary](#8-glossary)
9. [Frequently Asked Questions](#9-frequently-asked-questions)

---

## 1. Introduction

The Doc Aga Government Dashboard is a web-based analytics portal that aggregates livestock farm data across Philippine regions. It provides government officers with evidence-based insights for policy decisions, program evaluation, and farmer support.

**What it does:**
- Displays cross-farm statistics aggregated from individual farmer records
- Tracks livestock population, health, breeding, and milk production trends
- Captures and analyzes direct farmer feedback and concerns
- Measures grant program effectiveness and production economics

**What it does NOT do:**
- It does not show individual animal records (those are on each farmer's dashboard)
- It does not allow editing or modifying farm data
- It does not store personal farmer information — only aggregated statistics

### Data Sources

All data displayed on the government dashboard comes from farmer activity in the Doc Aga mobile app. When a farmer records a milking session, health check, or breeding event, that data flows into the government analytics in real-time (when online).

**Important:** The dashboard requires an internet connection. Data is always fetched live from the server — it is never cached locally — to ensure you always see the most current information.

---

## 2. Getting Started

### Accessing the Dashboard

Navigate to the Government Dashboard URL provided by your administrator. You will need to sign in with your government account credentials.

### Data Source Toggle

At the top-right corner, you will see a **"Demo Data / Live Data"** toggle:
- **Live Data** — Real farm data from registered farmers. Use this for actual monitoring and reporting.
- **Demo Data** — Sample training data. Use this when learning the dashboard or conducting training sessions.

### Dashboard Layout

The dashboard has **three main tabs** accessible from the tab bar near the top:

| Tab | Purpose |
|-----|---------|
| **Livestock Analytics** | Farm population, health, breeding, and trend data |
| **Farmer Voice** | Farmer feedback, concerns, and sentiment analysis |
| **Programs & Insights** | Grant program effectiveness, milk production economics, platform adoption |

---

## 3. Tab 1: Livestock Analytics

This is the primary monitoring tab. It provides a comprehensive view of the livestock sector across your jurisdiction.

### 3.1 Population Overview

**Section header:** "Population Overview — Census & geographic distribution"

This section shows the overall state of the livestock sector for your selected filters.

#### Metric Cards (Top Row)

| Card | What It Shows | How It's Computed |
|------|--------------|-------------------|
| **Active Farms** | Number of registered farms currently operating | Count of farms where `is_deleted = false`, filtered by selected region/province/municipality |
| **Active Animals** | Total living animals across all filtered farms | Count of animals that are alive (`exit_date` is empty) and not deleted (`is_deleted = false`) |
| **Daily Logs** | Total milking records in the selected date range | Count of milking records with `record_date` within the selected period |
| **Health Events** | Health check-ups and treatments recorded | Count of health records with `visit_date` within the selected period, for non-deleted animals only |
| **Avg Milk (Liters)** | Average daily milk production per milking record | Total liters divided by number of milking records in the period |
| **Doc Aga Queries** | Number of AI assistant consultations | Count of questions farmers asked the Doc Aga AI within the selected period |

Each card also shows a **percentage change** compared to the previous equivalent period. For example, if you select "Last 30 Days," the change compares against the 30 days before that.

#### Regional Livestock Distribution Map

An interactive map of the Philippines showing farm clusters by region. Each green marker represents a cluster of farms — the marker size indicates the number of farms in that area. Click a marker to zoom into that region.

### 3.2 Reproduction & Breeding

**Section header:** "Reproduction & Breeding — Heat detection through delivery"

This section tracks the breeding pipeline from heat detection through to expected deliveries.

#### Heat Detection Analytics

| Metric | Definition |
|--------|-----------|
| **Heat Events** | Number of heat detection records logged by farmers in the period |
| **Avg Cycle (days)** | Average number of days between consecutive heat events for the same animal. A healthy cycle is typically 18-24 days for cattle. Shows "No data" if insufficient records exist |
| **Ready for AI** | Number of female animals currently in their optimal breeding window (heat detected 18-21 days ago). These animals should be prioritized for artificial insemination |

#### Breeding Overview Cards

| Card | Definition |
|------|-----------|
| **AI Scheduled** | Number of artificial insemination procedures planned but not yet performed |
| **AI Performed** | Number of AI procedures that have been carried out |
| **Currently Pregnant** | Number of animals with confirmed pregnancy from AI records |
| **AI Success Rate** | Percentage of performed AI procedures that resulted in confirmed pregnancy: `(confirmed pregnancies / total AI performed) x 100` |
| **Due This Quarter** | Number of pregnant animals with expected delivery dates within the current quarter |
| **Unique Semen Codes** | Number of distinct semen/bull codes used, indicating genetic diversity in breeding programs |

#### AI Success Rate by Livestock Type (Chart)

A horizontal bar chart showing the breeding success rate broken down by species (Cattle, Goat, Carabao, Sheep). This helps identify which species have the highest AI success rates and where additional breeding support may be needed.

#### Expected Deliveries Timeline

A monthly timeline showing:
- **Number of expected deliveries per month** (based on AI date + gestation period)
- **Risk breakdown** for pregnant animals:
  - **Critical risk** — Animals with multiple risk factors requiring immediate attention
  - **High risk** — Animals with significant concerns
  - **Moderate risk** — Animals requiring routine monitoring
  - **Low risk** — Healthy pregnancies progressing normally

### 3.3 Animal Health & Welfare

**Section header:** "Animal Health & Welfare — Preventive care, nutrition, mortality"

#### Preventive Health Compliance

| Metric | Definition |
|--------|-----------|
| **Vaccination Compliance** | Percentage of scheduled vaccinations that have been completed: `(completed / scheduled) x 100`. Displayed as a progress bar. |
| **Vaccinations — Completed** | Number of vaccination records marked as administered |
| **Vaccinations — Scheduled** | Number of vaccination records that are planned/upcoming |
| **Deworming — Completed** | Number of deworming treatments administered |
| **Deworming — Scheduled** | Number of deworming treatments planned |

A compliance rate above 80% is generally considered healthy for a regional program.

#### Body Condition Scores (BCS)

Body Condition Scoring is a visual/physical assessment of animal nutrition and health on a 1-5 scale.

| Metric | Definition |
|--------|-----------|
| **Average BCS** | Mean body condition score across all assessed animals in the period |
| **Total Assessments** | Number of BCS evaluations performed |
| **Underweight (<2.5)** | Animals scoring below 2.5 — may need nutritional intervention |
| **Optimal (2.5-4.0)** | Animals in the healthy range |
| **Overweight (>4.0)** | Animals above optimal — may indicate overfeeding or metabolic issues |

The donut chart shows the distribution visually. A healthy herd typically has the majority of animals in the Optimal range.

#### Animal Exits & Mortality

This card tracks all animal removals from the active herd and mortality rates.

| Metric | Definition |
|--------|-----------|
| **Total Exits** | Number of animals that left the active herd during the selected period, for any reason |
| **Mortality Rate** | Percentage of animals that died: `deaths / (active animals + deaths in period) x 100`. This denominator includes animals that died, providing an accurate rate. |
| **Sales Revenue** | Total revenue from animals sold during the period |

**Exit Breakdown (Donut Chart):**
- **Sold** — Animals sold to other farms or markets
- **Died** — Animals that died from disease, injury, or natural causes
- **Culled** — Animals deliberately removed from the herd (e.g., for low productivity)
- **Transferred** — Animals moved to another farm
- **Slaughtered** — Animals processed for meat

**Mortality rate interpretation:**
- **0-2%** (Green, "Healthy") — Normal range
- **2-5%** (Yellow, "Moderate") — Warrants attention
- **>5%** (Red, "High Risk") — Requires investigation and intervention

#### Animal Health Heatmap

A geographic breakdown of health events by municipality, showing:
- **Municipality name and region**
- **Number of health events** in the last 7 days
- **Number of animals** in that municipality
- **Prevalence rate** — percentage of animals with health events: `(health events / total animals) x 100`
- **Severity badge** (Critical, High, Moderate, Low) based on prevalence rate
- **Symptom types** — Common diagnoses observed (e.g., "Mastitis", "Hoof Trimming")

This helps identify disease hotspots that may require targeted veterinary interventions.

### 3.4 Trends & Insights

**Section header:** "Trends & Insights — Analytics and farmer engagement"

Three time-series charts showing data over the selected date range:

#### Farm Growth Trend
Shows the number of active farms over time. An upward trend indicates growing program adoption. The area under the curve is shaded with a gradient for easy visual tracking.

#### Livestock Composition Trend
A stacked area chart showing the animal population broken down by species (Cattle, Goat, Carabao, Sheep) over time. This reveals:
- Overall herd growth or decline
- Which species are growing fastest
- Seasonal patterns in livestock numbers

#### Health Events Trend
Shows the daily count of health events over time. Spikes may indicate disease outbreaks or seasonal health challenges that need attention.

**Comparison Mode:** When comparison mode is enabled (see Section 6), these charts overlay the comparison dataset as a dashed line, allowing direct visual comparison between two regions or time periods.

---

## 4. Tab 2: Farmer Voice

This tab captures and organizes direct farmer feedback to help government officers understand real-world concerns and respond effectively.

### 4.1 Dashboard Overview

The top section shows summary statistics:

| Metric | Definition |
|--------|-----------|
| **Total Submissions** | All farmer feedback entries ever received |
| **Pending Review** | Submissions that have not yet been acknowledged or actioned |
| **Critical Cases** | Submissions marked as critical priority requiring urgent attention |
| **Last 7 Days** | Number of new submissions in the past week |

### 4.2 Top Concerns

A ranked list of the most common concern categories across all farmer feedback. Categories include topics like "Training Requests," "Veterinary Support," "Feed Shortage," "Financial Assistance," and "Disease Outbreaks." Each shows its count and percentage of total feedback.

### 4.3 Feedback Priority Queue

The main working area for government officers. Each feedback card shows:
- **Priority badges** (Critical, Urgent, Normal) and **category tags** (Disease, Emergency, etc.)
- **Feedback text** — The farmer's actual concern in their own words
- **Location** — Municipality and province of the submitting farm
- **Time** — When the feedback was submitted
- **Status** — Current workflow state

**Feedback Workflow States:**
1. **Submitted** — Farmer has sent the feedback (initial state)
2. **Acknowledged** — Government officer has seen it
3. **Under Review** — Being investigated
4. **Action Taken** — Response or intervention has been deployed
5. **Resolved** — Issue has been addressed to completion
6. **Closed** — Final state

Officers can update status, add notes, and track resolution through the "View & Action" button.

### 4.4 Geographic Concern Heatmap

A geographic breakdown showing feedback volume and severity by municipality. Each entry displays:
- **Municipality and region name**
- **Critical count badge** — Number of critical-priority submissions from that area
- **Total count** — All submissions from that area
- **Colored bars** — Visual representation of feedback volume by severity

### 4.5 Sentiment Trend (Last 14 Days)

A stacked area chart showing the daily distribution of feedback sentiment over the past 14 days:
- **Urgent** (Red) — Feedback requiring immediate attention
- **Negative** (Orange) — Concerns and complaints
- **Neutral** (Gray) — Informational feedback
- **Positive** (Green) — Praise and success stories

This helps identify whether farmer sentiment is improving or deteriorating over time.

### 4.6 Feedback Clusters

Groups similar feedback topics together automatically. This reveals recurring themes that individual feedback items might not show. Large clusters indicate systemic issues affecting many farmers.

### 4.7 Smart Insights & Recommendations

AI-generated analysis of feedback patterns, including:
- **Geographic Hotspots** — Areas with concentrated concerns
- **Trend Alerts** — Emerging issues gaining frequency
- **Recommended Actions** — Suggested government responses based on feedback patterns

---

## 5. Tab 3: Programs & Insights

This tab evaluates the effectiveness of government programs and tracks production economics.

### 5.1 Grant Program Distribution

Shows how the livestock population was acquired and the impact of government grant programs.

#### Total Active Animals
The total count of living, non-deleted animals across all filtered farms. This number should match the "Active Animals" figure on the Livestock Analytics tab when using the same filters.

#### Grant Recipients vs. Purchased Animals

| Metric | Definition |
|--------|-----------|
| **Grant Recipients** | Animals acquired through government grant programs. Shows count and percentage of total herd. |
| **Purchased Animals** | Animals bought by farmers. Shows count and average purchase price. |

#### Acquisition Overview Bar
A horizontal stacked bar showing the distribution of how animals were acquired:
- **Purchased** (Blue) — Bought by the farmer
- **Grant** (Green) — Received through a government grant program
- **Born on Farm** (Amber) — Offspring born from existing animals
- **Unknown** (Gray) — Acquisition type not recorded

#### By Grant Source
Breaks down grant-distributed animals by the granting organization (e.g., "national_dairy_authority," "local_government_unit"). Each source shows its count and percentage of total grant animals.

### 5.2 Grant Program Effectiveness

This section compares health and productivity outcomes between grant animals, purchased animals, and farm-born animals.

#### Head-to-Head Comparison

For each acquisition type (Grant, Purchased, Born on Farm), the following metrics are calculated:

| Metric | Definition |
|--------|-----------|
| **Animal Count** | Number of active animals in this category |
| **Health Events/Animal** | Average number of health records per animal. Lower is generally better. |
| **Milk L/Animal** | Average milk production per milking animal. Higher indicates better productivity. |
| **Mortality Rate** | Percentage of animals in this category that died. Lower is better. |
| **Breeding Success** | Percentage of AI procedures resulting in confirmed pregnancy. Higher is better. |

This comparison helps evaluate whether grant-distributed animals perform comparably to purchased or farm-bred animals.

#### Performance by Grant Source
Further breaks down grant animal performance by the specific grant program/source, allowing evaluation of which grant sources provide the healthiest and most productive animals.

### 5.3 Production Economics

**Section header:** "Production Economics — Milk production, market prices, and feed security"

#### Milk Production by Species

**Summary cards** showing for the selected date range:
- **Total Milk** — All milk production in liters
- **Cattle** — Cattle milk liters, percentage of total, and average price per liter
- **Goat** — Goat milk liters, percentage of total, and average price per liter
- **Carabao** — Carabao milk liters, percentage of total, and average price per liter

**Estimated Milk Revenue** — A highlighted card showing total estimated revenue from milk sales based on production volume and average prices for each species.

**Time-series chart** — A stacked area chart showing daily milk production by species over the selected date range, with smooth gradient fills for easy visual tracking.

#### Market Price Intelligence

Shows average milk prices per liter by species, helping identify pricing trends and opportunities for farmer guidance.

#### Feed Security Status

Monitors feed inventory across farms:

| Metric | Definition |
|--------|-----------|
| **Critical** | Farms with less than 7 days of feed remaining — requires immediate attention |
| **Low** | Farms with 7-30 days of feed — should plan procurement |
| **Adequate** | Farms with more than 30 days of feed — sufficient stock |
| **Feed Security Index** | Percentage of monitored farms with adequate feed: higher is better |

A **regional breakdown** shows feed security status by region with average days of feed remaining.

### 5.4 Platform Adoption

**Section header:** "Platform Adoption — System usage, data quality, and farmer engagement"

#### Top Farmer Queries

Shows the most common questions farmers ask the Doc Aga AI assistant, organized by topic (e.g., "General Health & Management," "Breeding & Reproduction"). This information helps identify knowledge gaps and inform training program content.

#### Farm Operational Health

Tracks how actively farms are using the system — identifying farms that may need onboarding support or technical assistance.

#### Data Quality Dashboard

Monitors the completeness and accuracy of farm data entries, helping identify areas where data quality improvement efforts should focus.

---

## 6. Filters & Data Controls

### Date Range

Available on the Livestock Analytics tab. Controls which time period the data covers.

**Presets:**
- **Last 7 Days** — Quick snapshot of recent activity
- **Last 30 Days** — Monthly view
- **Last 90 Days** — Quarterly view
- **Custom Range** — Pick specific start and end dates

The date range affects time-dependent metrics (milking records, health events, AI procedures) but NOT cumulative counts (total farms, total active animals).

### Location Filters

Hierarchical filters that cascade:
1. **Region** — Select a Philippine region (e.g., "Region IV-A - CALABARZON")
2. **Province** — Narrows to provinces within the selected region
3. **Municipality** — Narrows to municipalities within the selected province

Leave a filter blank to include all areas at that level.

### Comparison Mode

When enabled (toggle on the Livestock Analytics tab), a second set of filters appears. This allows comparing:
- **Two different time periods** for the same region
- **Two different regions** for the same time period
- **Any combination** of date range and location

Comparison data appears alongside primary data in charts (as dashed overlay lines) and in metric cards (showing both values).

### Data Category (Live vs Demo)

The toggle at the top-right switches between real and demo datasets. Demo data is used for training purposes and should not be referenced in official reports.

---

## 7. Exporting Data

The dashboard supports comprehensive data exports at two levels:

### Full Dashboard Report

Available via the **"Full Report"** dropdown button in the dashboard header. Downloads a report covering **all three tabs** (Livestock Analytics, Farmer Voice, Programs & Insights) in either PDF or CSV format. All active filters (date range, geography, data source) are respected.

- **PDF**: Professional formatted report with cover page, table of contents, and sections for each tab. Includes summary statistics, breeding data, health metrics, farmer feedback, grant analytics, milk production, and feed security.
- **CSV**: Machine-readable export with metadata header and clearly separated sections for each data domain. Suitable for spreadsheet analysis.

### Per-Tab Exports

Each tab has its own **"Export CSV"** and **"Export PDF"** buttons that download only that tab's data:

| Tab | Data Included |
|-----|---------------|
| **Livestock Analytics** | Summary statistics, breeding/reproduction, health & welfare (vaccination, BCS, mortality), PCRS risk scores, health heatmap, expected deliveries, farmer queries |
| **Farmer Voice** | Feedback overview, category breakdown, full feedback list with status/priority/sentiment |
| **Programs & Insights** | Grant distribution, regional investment, veterinary expenses, milk production by species, feed security status |

### Export Behavior

- Exports respect all active filters (date range, geography, data source)
- In comparison mode, both primary and comparison datasets are included
- Buttons show a loading spinner while data is being prepared
- File naming: `gov-full-report-{date}.pdf`, `gov-livestock-report-{date}.csv`, etc.

### Legacy: Feedback-Specific Export

The Farmer Voice tab also retains the original **Tools → Export** menu for feedback-specific exports with additional filtering options (All, Critical only, Pending only).

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| **Active Animal** | An animal that is alive (`exit_date` is empty) and not soft-deleted (`is_deleted = false`). This is the canonical definition used consistently across all dashboard views. |
| **AI (Artificial Insemination)** | A breeding technique where semen is manually introduced to a female animal. Not to be confused with "AI" as in Artificial Intelligence. |
| **BCS (Body Condition Score)** | A 1-5 scale assessment of an animal's nutritional status based on visual/physical evaluation. Optimal range is 2.5-4.0. |
| **Carabao** | Philippine water buffalo, used for both draft work and milk production. |
| **Data Category** | Classification of data as "Live" (real) or "Demo" (training/sample data). |
| **Doc Aga** | The AI veterinary assistant built into the farmer mobile app. Farmers ask it health and management questions. |
| **Exit** | When an animal leaves the active herd for any reason (sold, died, culled, transferred, slaughtered). |
| **Grant Animal** | An animal that was distributed to a farmer through a government grant program rather than purchased. |
| **Heat Detection** | Identifying when a female animal is in estrus (fertile period), indicating readiness for breeding. |
| **Mortality Rate** | Percentage of animals that died: `deaths / (active animals + deaths in period) x 100` |
| **PCRS (Pregnant Cow Risk Score)** | A risk scoring system that evaluates pregnant animals based on multiple factors to identify high-risk pregnancies. |
| **Prevalence Rate** | Percentage of animals affected by health events in a given area: `(health events / total animals) x 100` |
| **RLS (Row-Level Security)** | Database security mechanism ensuring government users can only see aggregated cross-farm data, not individual farm details. |
| **Vaccination Compliance** | Percentage of scheduled vaccinations that have been completed: `(completed / scheduled) x 100` |

---

## 9. Frequently Asked Questions

### Q: Why do the numbers on different tabs sometimes not match exactly?

**A:** Each tab may use slightly different date ranges or filter contexts. Always check that your filters (date range, region, data category) are set consistently. The "Active Animals" count should match between the Livestock Analytics overview and the Programs & Insights grant distribution when using the same filters.

### Q: What does "No data available" mean?

**A:** This means no records exist for the current filter combination. Try expanding the date range or removing region/province/municipality filters to see if data exists at a broader scope.

### Q: How often is the data updated?

**A:** Data updates in real-time as farmers submit records through the mobile app. However, some aggregated metrics may take a few seconds to recalculate after new data is entered.

### Q: Can I see which specific farm has a problem?

**A:** The government dashboard shows aggregated data at the municipality level, not individual farm data. For farm-level investigation, coordinate with your regional agricultural officer who has appropriate access.

### Q: What should I do if the mortality rate is above 5%?

**A:** A mortality rate above 5% (shown in red as "High Risk") indicates a potential systemic issue. Steps to take:
1. Check the Animal Health Heatmap to identify affected municipalities
2. Review the health event types (diagnoses) in those areas
3. Coordinate a veterinary response team for the affected municipalities
4. Monitor the Farmer Voice tab for related farmer concerns

### Q: How is the Feed Security Index calculated?

**A:** The Feed Security Index is the percentage of monitored farms that have more than 30 days of feed remaining. It is calculated from roughage inventory data reported by farmers. Farms with less than 7 days are classified as Critical.

### Q: What does "Comparison Mode" compare?

**A:** Comparison mode lets you visually overlay two datasets. Common uses:
- Compare this quarter vs. last quarter for the same region
- Compare two different regions for the same time period
- Track before/after effects of a program intervention

---

*This manual was prepared for the Doc Aga Government Dashboard v1.0. For technical support, contact your system administrator.*
