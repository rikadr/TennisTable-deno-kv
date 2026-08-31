import { classNames } from "./class-names";
import { joinJSX } from "./join-JSX";

export type IndicatorStep = { step: number; icon: string };

export const StepIndicator: React.FC<{ steps: readonly IndicatorStep[]; currentStep: number }> = ({
  steps: stepConfig,
  currentStep,
}) => {
  const steps: { component: JSX.Element; isCompleted: boolean }[] = stepConfig.map(({ step, icon }) => {
    const isActive = currentStep === step;
    const isCompleted = currentStep > step;

    return {
      isCompleted,
      component: (
        <div key={step} className="flex items-center">
          <div
            className={classNames(
              "relative flex items-center justify-center w-12 h-12 rounded-full text-xl",
              isActive || isCompleted
                ? "bg-tertiary-background text-tertiary-text"
                : "bg-primary-background text-primary-text border-2 border-secondary-background",
            )}
          >
            {isCompleted ? "✓" : icon}
          </div>
        </div>
      ),
    };
  });

  const completedSteps = steps.filter((step) => step.isCompleted === true);
  const remainingSteps = steps.filter((step) => step.isCompleted === false);

  const divider = (isCompleted: boolean) => (
    <div
      className={classNames("w-full grow h-1 mx-2", isCompleted ? "bg-tertiary-background" : "bg-secondary-background")}
    />
  );

  return (
    <div className="flex items-center mx-8 my-0">
      {joinJSX(
        completedSteps.map((step) => step.component),
        divider(true),
      )}
      {completedSteps.length > 0 && divider(true)}
      {joinJSX(
        remainingSteps.map((step) => step.component),
        divider(false),
      )}
    </div>
  );
};
