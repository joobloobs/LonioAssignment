import { OnboardingForm } from "@/components/OnboardingForm";

export default function OnboardingPage() {
  return (
    <>
      <h1>Employee onboarding</h1>
      <p className="lede">
        Enter your personal data. Non-Swiss employees answer a short questionnaire that
        determines the suggested source-tax tariff code.
      </p>
      <OnboardingForm />
    </>
  );
}
