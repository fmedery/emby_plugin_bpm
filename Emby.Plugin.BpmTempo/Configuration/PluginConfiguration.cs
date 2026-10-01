using MediaBrowser.Model.Plugins;

namespace Emby.Plugin.BpmTempo.Configuration
{
    public class PluginConfiguration : BasePluginConfiguration
    {
        public bool Enabled { get; set; } = true;
        public float DefaultTempo { get; set; } = 1.0f;
        public float MinTempo { get; set; } = 0.50f;
        public float MaxTempo { get; set; } = 1.50f;
        public float StepSize { get; set; } = 0.05f;
        public float FineStepSize { get; set; } = 0.01f;
        public bool PreservePitch { get; set; } = true;
        public bool EnablePitchShift { get; set; } = true;
        public int DefaultPitchShiftSemitones { get; set; } = 0;
        public bool ShowBpmCalculator { get; set; } = true;
        public bool EnableKeyboardShortcuts { get; set; } = true;
        public string SpeedPresets { get; set; } = "0.50,0.60,0.70,0.75,0.80,0.85,0.90,0.95,1.00";
        public bool AutoInjectWebClient { get; set; } = true;
    }
}
