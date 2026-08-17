import { getDb } from "@/server/db";
import { listEmployees } from "@/server/repositories/employees";
import { describeOutcome } from "@/lib/outcome";
import { COUNTRIES } from "@/countries";

export const dynamic = "force-dynamic";

function countryLabel(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.label ?? code;
}

export default function DashboardPage() {
  const rows = listEmployees(getDb());

  return (
    <>
      <h1>HR dashboard</h1>
      <p className="lede">
        Employees who completed onboarding. Non-Swiss employees show the suggested
        source-tax tariff computed from their answers.
      </p>
      {rows.length === 0 ? (
        <div className="card empty-state">
          No employees yet — complete an onboarding first.
        </div>
      ) : (
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Nationality</th>
                <th>Canton</th>
                <th>Source-tax tariff</th>
                <th>Engine</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const view = row.assessment ? describeOutcome(row.assessment.outcome) : undefined;
                return (
                  <tr key={row.id}>
                    <td>
                      {row.firstName} {row.lastName}
                    </td>
                    <td>{countryLabel(row.nationality)}</td>
                    <td>{row.canton}</td>
                    <td>
                      {!row.subjectToSourceTax ? (
                        <span className="muted">Not subject to source tax</span>
                      ) : view ? (
                        <>
                          {view.kind === "code" ? (
                            <span className="code-badge">{view.main}</span>
                          ) : (
                            <span className="ruling">{view.main}</span>
                          )}
                          {view.remark && <div className="remark">{view.remark}</div>}
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="muted">{row.assessment?.engineVersion ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
