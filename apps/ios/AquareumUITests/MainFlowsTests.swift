import XCTest

/// The main flows, against a mock-only instance: what a guest can do, and what a signed-in person does most.
@MainActor
final class MainFlowsTests: XCTestCase {
    private let app = XCUIApplication()

    private func launch(signedIn: Bool) throws {
        continueAfterFailure = false
        app.launchEnvironment["AQUAREUM_UI_TEST_SESSION"] = signedIn ? try Instance.signIn() : "signed-out"
        app.launch()
    }

    private func tab(_ name: String) -> XCUIElement { app.buttons[name].firstMatch }

    /// Generate reads its price with it, as in "Generate, 55 credits".
    private var generate: XCUIElement { app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Generate")).firstMatch }

    func testAGuestBrowsesAndIsAskedToSignInAtGenerate() throws {
        try launch(signedIn: false)
        XCTAssertTrue(app.staticTexts["Direct anything."].waitForExistence(timeout: 15))

        tab("Studio").tap()
        XCTAssertTrue(app.buttons["Video"].waitForExistence(timeout: 10))
        let prompt = app.textFields["Prompt"]
        XCTAssertTrue(prompt.waitForExistence(timeout: 5))
        prompt.tap()
        prompt.typeText("A paper boat drifting down a rain-soaked street")
        generate.tap()
        XCTAssertTrue(app.staticTexts["Sign in to generate. Your draft stays here."].waitForExistence(timeout: 5))
    }

    func testGeneratingInTheStudioRendersAShot() throws {
        try launch(signedIn: true)
        tab("Studio").tap()
        let prompt = app.textFields["Prompt"]
        XCTAssertTrue(prompt.waitForExistence(timeout: 15))
        prompt.tap()
        prompt.typeText("A lighthouse at dusk, slow push in")
        generate.tap()
        let shot = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Shot: A lighthouse at dusk, slow push in")).firstMatch
        XCTAssertTrue(shot.waitForExistence(timeout: 60))
    }

    func testTheLibraryAndACharacterOpen() throws {
        try launch(signedIn: true)
        tab("Library").tap()
        XCTAssertTrue(app.navigationBars["Library"].waitForExistence(timeout: 15))
        XCTAssertTrue(app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS[c] %@", ", video")).firstMatch.waitForExistence(timeout: 15))

        tab("Characters").tap()
        XCTAssertTrue(app.navigationBars["Characters"].waitForExistence(timeout: 15))
        let character = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "Mara")).firstMatch
        XCTAssertTrue(character.waitForExistence(timeout: 15))
        character.tap()
        XCTAssertTrue(app.buttons["More"].waitForExistence(timeout: 10))
    }

    func testSettingsShowThePlanAndCredits() throws {
        try launch(signedIn: true)
        let accountButton = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Account, ")).firstMatch
        XCTAssertTrue(accountButton.waitForExistence(timeout: 15))
        accountButton.tap()
        app.buttons["Settings"].tap()
        XCTAssertTrue(app.navigationBars["Settings"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] %@", "credits")).firstMatch.waitForExistence(timeout: 10))
    }
}
