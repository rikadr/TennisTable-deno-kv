import { classNames } from "../../common/class-names";
import { joinJSX } from "../../common/join-JSX";
import { ADD_GAME_STEPS } from "./add-game-page";

export const StepIndicator: React.FC<{ currentStep: number }> = ({ currentStep }) => {
  const steps: { component: JSX.Element; isCompleted: boolean }[] = ADD_GAME_STEPS.map(({ step, icon }, index) => {
    const isActive = currentStep === step;
    const isCompleted = currentStep > step;

    return {
      isCompleted,
      component: (
        <div key={step} className="flex items-center">
          <div
            className={`
              relative flex items-center justify-center w-12 h-12 rounded-full text-xl
              ${
                isActive || isCompleted
                  ? "bg-tertiary-background text-tertiary-text"
                  : "bg-primary-background text-primary-text border-2 border-secondary-background"
              }
            `}
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
