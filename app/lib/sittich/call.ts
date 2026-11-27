/** fired on window to call the Halsbandsittich (SittichEasterEgg.vue) right away, like pressing B */
export const SITTICH_CALL_EVENT = 'stammtisch:sittich'

export const callSittich = () => window.dispatchEvent(new Event(SITTICH_CALL_EVENT))
