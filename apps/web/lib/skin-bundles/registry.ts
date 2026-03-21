/**
 * Centralized registry for skin token bundles.
 *
 * This is the single entry point for getting a complete SkinTokens bundle.
 * Prefer this over the legacy getSkin() + getSkinCSSVars() path.
 */

import type { SkinTokens, SkinId } from "@guide-rail/shared";

// CLASSIC
import { classicMinimalTokens }   from "./classic-minimal";
import { classicStudioTokens }    from "./classic-studio";
import { classicPlayfulTokens }   from "./classic-playful";
import { classicBoldTokens }      from "./classic-bold";
import { classicElegantTokens }   from "./classic-elegant";

// CREATIVE
import { creativeRetroTokens }       from "./creative-retro";
import { creativeChalkboardTokens }  from "./creative-chalkboard";
import { creativeSheetMusicTokens }  from "./creative-sheet-music";
import { creativeLiteraryTokens }    from "./creative-literary";
import { creativeCodeTokens }        from "./creative-code";
import { creativeEsportsTokens }     from "./creative-esports";

// LIFESTYLE
import { lifestyleGlamTokens }       from "./lifestyle-glam";
import { lifestyleWanderlustTokens } from "./lifestyle-wanderlust";
import { lifestyleGraffitiTokens }   from "./lifestyle-graffiti";
import { lifestyleZenTokens }        from "./lifestyle-zen";
import { lifestyleScienceTokens }    from "./lifestyle-science";
import { lifestylePodcastTokens }    from "./lifestyle-podcast";

// ACTIVITY
import { activityHologramTokens } from "./activity-hologram";
import { activityWorkshopTokens } from "./activity-workshop";
import { activityCulinaryTokens } from "./activity-culinary";
import { activitySportsTokens }   from "./activity-sports";
import { activityKidsTokens }     from "./activity-kids";
import { activityFashionTokens }  from "./activity-fashion";

// ENTERTAINMENT
import { entertainmentFilmNoirTokens } from "./entertainment-film-noir";
import { entertainmentFestivalTokens } from "./entertainment-festival";

// MUSIC
import { musicSoundwaveTokens }  from "./music-soundwave";
import { musicBackstageTokens }  from "./music-backstage";
import { musicDancefloorTokens } from "./music-dancefloor";

// MEDIA
import { mediaHeroTokens }  from "./media-hero";
import { mediaFilmTokens }  from "./media-film";
import { mediaLensTokens }  from "./media-lens";
import { mediaPulseTokens } from "./media-pulse";

// PROFESSIONAL
import { proMindspaceTokens }     from "./pro-mindspace";
import { cosmicStudioTokens }     from "./cosmic-studio";
import { proAtelierTokens }       from "./pro-atelier";
import { proStartupTokens }       from "./pro-startup";
import { proWellnessTokens }      from "./pro-wellness";
import { proHomeGymTokens }       from "./pro-home-gym";
import { proCreatorTokens }       from "./pro-creator";
import { proLuxuryTokens }        from "./pro-luxury";
import { proStreetFitnessTokens } from "./pro-street-fitness";
import { proMindMapTokens }       from "./pro-mind-map";
import { proBookNookTokens }      from "./pro-book-nook";
import { proAdventureTokens }     from "./pro-adventure";
import { aiCommandCenterTokens }  from "./ai-command-center";

export const SKIN_TOKENS: Record<SkinId, SkinTokens> = {
  // CLASSIC
  "classic-minimal":  classicMinimalTokens,
  "classic-studio":   classicStudioTokens,
  "classic-playful":  classicPlayfulTokens,
  "classic-bold":     classicBoldTokens,
  "classic-elegant":  classicElegantTokens,

  // CREATIVE
  "creative-retro":       creativeRetroTokens,
  "creative-chalkboard":  creativeChalkboardTokens,
  "creative-sheet-music": creativeSheetMusicTokens,
  "creative-literary":    creativeLiteraryTokens,
  "creative-code":        creativeCodeTokens,
  "creative-esports":     creativeEsportsTokens,

  // LIFESTYLE
  "lifestyle-glam":       lifestyleGlamTokens,
  "lifestyle-wanderlust": lifestyleWanderlustTokens,
  "lifestyle-graffiti":   lifestyleGraffitiTokens,
  "lifestyle-zen":        lifestyleZenTokens,
  "lifestyle-science":    lifestyleScienceTokens,
  "lifestyle-podcast":    lifestylePodcastTokens,

  // ACTIVITY
  "activity-hologram": activityHologramTokens,
  "activity-workshop": activityWorkshopTokens,
  "activity-culinary": activityCulinaryTokens,
  "activity-sports":   activitySportsTokens,
  "activity-kids":     activityKidsTokens,
  "activity-fashion":  activityFashionTokens,

  // ENTERTAINMENT
  "entertainment-film-noir": entertainmentFilmNoirTokens,
  "entertainment-festival":  entertainmentFestivalTokens,

  // MUSIC
  "music-soundwave":  musicSoundwaveTokens,
  "music-backstage":  musicBackstageTokens,
  "music-dancefloor": musicDancefloorTokens,

  // MEDIA
  "media-hero":  mediaHeroTokens,
  "media-film":  mediaFilmTokens,
  "media-lens":  mediaLensTokens,
  "media-pulse": mediaPulseTokens,

  // PROFESSIONAL
  "pro-mindspace":     proMindspaceTokens,
  "cosmic-studio":     cosmicStudioTokens,
  "pro-atelier":       proAtelierTokens,
  "pro-startup":       proStartupTokens,
  "pro-wellness":      proWellnessTokens,
  "pro-home-gym":      proHomeGymTokens,
  "pro-creator":       proCreatorTokens,
  "pro-luxury":        proLuxuryTokens,
  "pro-street-fitness": proStreetFitnessTokens,
  "pro-mind-map":      proMindMapTokens,
  "pro-book-nook":     proBookNookTokens,
  "pro-adventure":     proAdventureTokens,
  "ai-command-center": aiCommandCenterTokens,
};

/**
 * Look up a complete SkinTokens bundle by skin ID.
 * Falls back to classic-minimal for unknown IDs.
 */
export function getSkinTokens(skinId: string): SkinTokens {
  return SKIN_TOKENS[skinId as SkinId] ?? SKIN_TOKENS["classic-minimal"];
}
