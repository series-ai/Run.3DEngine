export class UILoadingScreen {
  private static loadingScreenElement: HTMLDivElement | null = null;

  /**
   * Show the loading screen with a spinner
   * @param message Optional loading message to display
   * @param backgroundColor Optional background color (default: #1a1a1a)
   */
  static showLoadingScreen(
    message: string = "Loading...",
    backgroundColor: string = "#1a1a1a"
  ): void {
    // Prevent multiple loading screens
    if (this.loadingScreenElement) {
      return;
    }

    const loadingScreen = document.createElement("div");
    loadingScreen.id = "loadingScreen";

    // Apply styles
    Object.assign(loadingScreen.style, {
      position: "fixed",
      left: "0",
      right: "0",
      top: "0",
      bottom: "0",
      backgroundColor: backgroundColor,
      zIndex: "9999",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      fontFamily: "Arial, sans-serif",
    });

    // Create spinner
    const spinner = document.createElement("div");
    spinner.className = "spinner";
    Object.assign(spinner.style, {
      width: "60px",
      height: "60px",
      border: "6px solid rgba(255, 255, 255, 0.2)",
      borderTop: "6px solid #ffffff",
      borderRadius: "50%",
      animation: "spin 1s linear infinite",
    });

    // Create loading text
    // const loadingText = document.createElement("p");
    // loadingText.textContent = message;
    // Object.assign(loadingText.style, {
    //   color: "#ffffff",
    //   fontSize: "18px",
    //   marginTop: "20px",
    //   fontWeight: "500",
    // });

    // Add CSS animation
    this.addSpinnerAnimation();

    // Append elements
    loadingScreen.appendChild(spinner);
    // loadingScreen.appendChild(loadingText);
    document.body.appendChild(loadingScreen);

    this.loadingScreenElement = loadingScreen;
  }

  /**
   * Hide and remove the loading screen
   * @param fadeOut Optional fade out animation (default: true)
   */
  static hideLoadingScreen(fadeOut: boolean = true): void {
    if (!this.loadingScreenElement) {
      return;
    }

    if (fadeOut) {
      this.loadingScreenElement.style.transition = "opacity 0.3s ease-out";
      this.loadingScreenElement.style.opacity = "0";

      setTimeout(() => {
        this.removeLoadingScreen();
      }, 300);
    } else {
      this.removeLoadingScreen();
    }
  }

  /**
   * Remove the loading screen from DOM
   */
  private static removeLoadingScreen(): void {
    if (this.loadingScreenElement) {
      this.loadingScreenElement.remove();
      this.loadingScreenElement = null;
    }
  }

  /**
   * Add spinner animation to the document
   */
  private static addSpinnerAnimation(): void {
    // Check if animation already exists
    if (document.getElementById("spinner-animation")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "spinner-animation";
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
}