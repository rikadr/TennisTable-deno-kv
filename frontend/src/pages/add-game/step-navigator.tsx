export const StepNavigator: React.FC<{
  currentStep: number;
  canProceed: boolean;
  handleNext: () => void;
  handleBack: () => void;
  handleSubmit: () => void;
  isSubmitting: boolean;
}> = ({ currentStep, canProceed, handleNext, handleBack, handleSubmit, isSubmitting }) => {
  return (
    <div className="p-6 bg-secondary-background mt-6">
      <div className="flex space-x-3">
        {currentStep > 1 && (
          <button
            onClick={handleBack}
            className="flex-1 py-3 px-4 bg-primary-background hover:bg-primary-background/30 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-colors"
          >
            <span>← Back</span>
          </button>
        )}

        {currentStep < 3 ? (
          <button
            onClick={handleNext}
            disabled={!canProceed}
            className={`
                  flex-1 py-3 px-4 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-colors
                  ${
                    canProceed
                      ? "bg-tertiary-background text-tertiary-text hover:bg-tertiary-background/75"
                      : "bg-tertiary-background/30 text-tertiary-text/50 cursor-not-allowed"
                  }
                `}
          >
            <span>Next →</span>
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`
                  flex-1 py-3 px-4 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-colors
                  ${
                    isSubmitting
                      ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700 text-white"
                  }
                `}
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Adding Game...</span>
              </>
            ) : (
              <>
                <span>✓ Add Game</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
