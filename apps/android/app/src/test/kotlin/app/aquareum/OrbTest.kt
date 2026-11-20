package app.aquareum

import app.aquareum.chat.orbState
import app.aquareum.design.orb.OrbState
import app.aquareum.design.orb.preset
import app.aquareum.generated.AgentStep
import app.aquareum.generated.AgentStepKind
import app.aquareum.generated.AgentStepState
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.double
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs

/** The orb draws the library's own frames, dot for dot, and shows the kind of work each step is. */
class OrbTest {
    @Test
    fun framesMatchTheLibrarysGoldenFrames() {
        val golden = Json.parseToJsonElement(javaClass.getResource("/orb-golden.json")!!.readText()).jsonObject
        val tolerance = golden["tolerance"]!!.jsonPrimitive.double
        val cases = golden["cases"]!!.jsonArray
        assertEquals(24, cases.size)
        for (case in cases) {
            case as JsonObject
            val state = OrbState.valueOf(case["state"]!!.jsonPrimitive.content.replaceFirstChar { it.uppercase() })
            val t = case["t"]!!.jsonPrimitive.double
            val expected = case["dots"]!!.jsonArray.map { it.jsonPrimitive.double }
            val dots = preset(state).frame(t)
            val label = "$state at $t"
            assertEquals("$label: dot count", expected.size / 6, dots.size)
            dots.forEachIndexed { i, dot ->
                val want = expected.subList(i * 6, i * 6 + 6)
                val got = listOf(dot.x, dot.y, dot.z, dot.r, dot.white, dot.a)
                for (k in 0 until 6) assertTrue("$label: dot $i field $k is ${got[k]}, wanted ${want[k]}", abs(got[k] - want[k]) <= tolerance)
            }
        }
    }

    @Test
    fun eachStepReadsAsItsKindOfWork() {
        fun step(kind: AgentStepKind, app: String?) = AgentStep("stp", kind, "", "", app, AgentStepState.Running)
        assertEquals(OrbState.Breathing, orbState(null))
        assertEquals(OrbState.Solving, orbState(step(AgentStepKind.Plan, null)))
        assertEquals(OrbState.Searching, orbState(step(AgentStepKind.Review, "video-understanding")))
        assertEquals(OrbState.Composing, orbState(step(AgentStepKind.Tool, "image-to-video")))
        assertEquals(OrbState.Weaving, orbState(step(AgentStepKind.Tool, "chat")))
        assertEquals(OrbState.Working, orbState(step(AgentStepKind.Tool, "something-new")))
    }
}
