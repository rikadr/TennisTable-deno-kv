import { StepBackButton, StepFooter, StepForwardButton } from "../../common/step-footer";

export const StepNavigator: React.FC<{
  currentStep: number;
  canProceed: boolean;
  handleNext: () => void;
  handleBack: () => void;
  handleSubmit: () => void;
  isSubmitting: boolean;
  hasSubmitted: boolean;
}> = ({ currentStep, canProceed, handleNext, handleBack, handleSubmit, isSubmitting, hasSubmitted }) => {
  const isLastStep = currentStep === 3;
  return (
    <StepFooter>
      {currentStep > 1 && <StepBackButton onClick={handleBack} disabled={hasSubmitted} />}

      <StepForwardButton
        onClick={isLastStep ? (!isSubmitting ? handleSubmit : undefined) : handleNext}
        disabled={!canProceed || isSubmitting || hasSubmitted}
      >
        {!isLastStep && <span>Next →</span>}
        {isLastStep && (
          <>
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Adding Game...</span>
              </>
            ) : (
              <>
                <span>{hasSubmitted ? "✓ Success" : "✓ Add Game"}</span>
              </>
            )}
          </>
        )}
      </StepForwardButton>
    </StepFooter>
  );
};
