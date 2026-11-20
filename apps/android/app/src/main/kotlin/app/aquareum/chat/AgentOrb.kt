package app.aquareum.chat

import app.aquareum.design.orb.OrbState
import app.aquareum.generated.AgentStep
import app.aquareum.generated.AgentStepKind

private val SEARCHING = listOf("understanding", "detect", "segment", "caption", "transcri")
private val COMPOSING = listOf("to-video", "to-image", "image-edit", "video-edit", "music", "sfx", "tts", "speech", "audio", "3d", "upscale", "restyle")
private val WEAVING = listOf("chat", "llm", "text")

/**
 * What the agent's orb shows for the step it is on, so the motion says what kind of work is happening: planning
 * reads as solving, watching or checking as searching, making media as composing, writing a prompt as weaving.
 * Between steps it breathes. The same mapping as the web's `agentOrbState` and iOS's `OrbState(step:)`.
 */
fun orbState(step: AgentStep?): OrbState {
    step ?: return OrbState.Breathing
    if (step.kind == AgentStepKind.Plan) return OrbState.Solving
    if (step.kind == AgentStepKind.Review) return OrbState.Searching
    val app = step.app.orEmpty()
    return when {
        SEARCHING.any { it in app } -> OrbState.Searching
        COMPOSING.any { it in app } -> OrbState.Composing
        WEAVING.any { it in app } -> OrbState.Weaving
        else -> OrbState.Working
    }
}
