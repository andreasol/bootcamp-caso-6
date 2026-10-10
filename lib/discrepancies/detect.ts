// Deterministic discrepancy engine: compares normalized local vs global records.
// All arithmetic (variance, %, threshold multiple) happens here, never in the model.
import { round2 } from "@/lib/integration/formats";
import {
  LEAVE_CONCEPT,
  recordKey,
  type Discrepancy,
  type FileRef,
  type NormalizedRecord,
  type SourceSystem,
  type Threshold,
} from "@/lib/domain/types";
import { rulePriority } from "./priority";

export interface DetectInput {
  local: NormalizedRecord[];
  global: NormalizedRecord[];
  systems: SourceSystem[];
  expected: FileRef[];
  received: FileRef[];
  thresholds: Threshold[];
  // keys whose local row is in quarantine: not reported as missing_in_local
  blockedKeys: Set<string>;
}

const fileKey = (f: FileRef) => `${f.period}|${f.countryCode}|${f.systemCode}`;
const domainOf = (concept: string) => (concept === LEAVE_CONCEPT ? "leave" : "payroll");

export function findThreshold(thresholds: Threshold[], countryCode: string, concept: string): Threshold {
  const t =
    thresholds.find((x) => x.countryCode === countryCode && x.concept === concept) ??
    thresholds.find((x) => x.countryCode === null && x.concept === concept);
  // Fail loudly: a missing threshold is a configuration error, not "no discrepancy".
  if (!t) throw new Error(`No threshold for ${countryCode}/${concept}`);
  return t;
}

// |diff| > abs OR |diff|/|global| > pct. Returns how many times the larger exceeded threshold.
export function evaluateVariance(localValue: number, globalValue: number, t: Threshold) {
  const variance = round2(localValue - globalValue);
  const absDiff = Math.abs(variance);
  const variancePct = globalValue === 0 ? null : Math.round((absDiff / Math.abs(globalValue)) * 10000) / 10000;
  const absMultiple = t.abs > 0 ? absDiff / t.abs : absDiff > 0 ? Infinity : 0;
  const pctMultiple = variancePct === null ? (absDiff > 0 ? Infinity : 0) : t.pct > 0 ? variancePct / t.pct : 0;
  const exceeds = absDiff > t.abs || (variancePct !== null && variancePct > t.pct);
  return { variance, variancePct, exceeds, multiple: Math.max(absMultiple, pctMultiple) };
}

export function detectDiscrepancies(input: DetectInput): Discrepancy[] {
  const out: Discrepancy[] = [];
  const received = new Set(input.received.map(fileKey));
  const systemByCode = new Map(input.systems.map((s) => [s.code, s]));

  // 1. Missing files
  for (const exp of input.expected) {
    if (received.has(fileKey(exp))) continue;
    const { priority, reason } = rulePriority({ type: "missing_file", unit: null, thresholdMultiple: null });
    out.push({
      type: "missing_file",
      period: exp.period,
      countryCode: exp.countryCode,
      employeeGlobalId: null,
      concept: null,
      sourceSystemCode: exp.systemCode,
      unit: null,
      localValue: null,
      globalValue: null,
      variance: null,
      variancePct: null,
      thresholdAbs: null,
      thresholdPct: null,
      localRecordId: null,
      globalRecordId: null,
      rulePriority: priority,
      ruleReason: reason,
    });
  }

  // 2. Record comparison only where both sides were expected and actually arrived.
  // A missing file is reported once above instead of as hundreds of missing records.
  const comparable = new Set<string>(); // period|country|domain
  const groups = new Map<string, { local: boolean; global: boolean; allReceived: boolean }>();
  for (const exp of input.expected) {
    const sys = systemByCode.get(exp.systemCode);
    if (!sys) throw new Error(`Unknown system ${exp.systemCode}`);
    const g = `${exp.period}|${exp.countryCode}|${sys.domain}`;
    const entry = groups.get(g) ?? { local: false, global: false, allReceived: true };
    entry[sys.kind] = true;
    if (!received.has(fileKey(exp))) entry.allReceived = false;
    groups.set(g, entry);
  }
  for (const [g, e] of groups) if (e.local && e.global && e.allReceived) comparable.add(g);

  const index = (records: NormalizedRecord[]) => {
    const m = new Map<string, NormalizedRecord>();
    for (const r of records) {
      const k = recordKey(r.period, r.employeeGlobalId, r.concept);
      if (m.has(k)) throw new Error(`Duplicate ${r.sourceKind} record for ${k}`);
      m.set(k, r);
    }
    return m;
  };
  const localIdx = index(input.local);
  const globalIdx = index(input.global);
  const keys = [...new Set([...localIdx.keys(), ...globalIdx.keys()])].sort();

  for (const k of keys) {
    const l = localIdx.get(k);
    const g = globalIdx.get(k);
    const ref = (l ?? g)!;
    if (!comparable.has(`${ref.period}|${ref.countryCode}|${domainOf(ref.concept)}`)) continue;

    const base = {
      period: ref.period,
      countryCode: ref.countryCode,
      employeeGlobalId: ref.employeeGlobalId,
      concept: ref.concept,
      sourceSystemCode: null,
      unit: ref.unit,
      localRecordId: l?.sourceRecordId ?? null,
      globalRecordId: g?.sourceRecordId ?? null,
    };

    if (l && g) {
      const t = findThreshold(input.thresholds, ref.countryCode, ref.concept);
      const v = evaluateVariance(l.amount, g.amount, t);
      if (!v.exceeds) continue;
      const type = ref.concept === LEAVE_CONCEPT ? "leave_balance_mismatch" : "amount_mismatch";
      const { priority, reason } = rulePriority({ type, unit: ref.unit, thresholdMultiple: v.multiple });
      out.push({
        ...base,
        type,
        localValue: l.amount,
        globalValue: g.amount,
        variance: v.variance,
        variancePct: v.variancePct,
        thresholdAbs: t.abs,
        thresholdPct: t.pct,
        rulePriority: priority,
        ruleReason: reason,
      });
      continue;
    }

    if (!l && input.blockedKeys.has(k)) continue;
    const type = l ? "missing_in_global" : "missing_in_local";
    const { priority, reason } = rulePriority({ type, unit: ref.unit, thresholdMultiple: null });
    out.push({
      ...base,
      type,
      localValue: l?.amount ?? null,
      globalValue: g?.amount ?? null,
      variance: null,
      variancePct: null,
      thresholdAbs: null,
      thresholdPct: null,
      rulePriority: priority,
      ruleReason: reason,
    });
  }

  return out;
}
