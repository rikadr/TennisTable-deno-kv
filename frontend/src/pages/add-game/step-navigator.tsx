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
    <div className="p-6 bg-secondary-background">
      <div className="flex space-x-3">
        {currentStep > 1 && (
          <button
            onClick={handleBack}
            disabled={hasSubmitted}
            className="text-primary-text flex-1 py-3 px-4 bg-primary-background hover:bg-primary-background/80 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-colors"
          >
            <span>← Back</span>
          </button>
        )}

        <button
          onClick={isLastStep ? (!isSubmitting ? handleSubmit : undefined) : handleNext}
          disabled={!canProceed || isSubmitting || hasSubmitted}
          className={`
                  flex-1 py-3 px-4 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-colors ring-1 ring-primary-background
                  ${
                    canProceed && !isSubmitting && !hasSubmitted
                      ? "bg-tertiary-background text-tertiary-text hover:bg-tertiary-background/75"
                      : "bg-tertiary-background/50 text-tertiary-text/50 cursor-not-allowed"
                  }
                `}
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
        </button>
      </div>
    </div>
  );
};
