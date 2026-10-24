import { describe, expect, it } from "vitest";
import { alarmJobs, OPEN_JOB_ALARM_MS } from "@/lib/open-job-alarm";

const job = (id: string, places_left: number) => ({ id, places_left });

describe("open job alarm", () => {
  it("repeats every five minutes", () => {
    expect(OPEN_JOB_ALARM_MS).toBe(300_000);
  });

  it("alarms only for jobs with free places", () => {
    expect(alarmJobs([job("a", 2), job("b", 0)], new Set()).map((j) => j.id)).toEqual(["a"]);
  });

  it("stops alarming for dismissed jobs", () => {
    expect(alarmJobs([job("a", 2), job("b", 1)], new Set(["a"])).map((j) => j.id)).toEqual(["b"]);
  });

  it("stays silent when nothing is open", () => {
    expect(alarmJobs([], new Set())).toEqual([]);
  });
});
