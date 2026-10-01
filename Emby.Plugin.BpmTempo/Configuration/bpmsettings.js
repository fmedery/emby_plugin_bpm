define(['loading', 'dialogHelper'], function (loading, dialogHelper) {
    'use strict';

    var pluginId = "7F5A4D2E-8B3C-4D1E-9A5F-6C7D8E9F0A1B";

    function loadSettings(page) {
        loading.show();
        ApiClient.getPluginConfiguration(pluginId).then(function (config) {
            page.querySelector('#chkEnabled').checked = config.Enabled !== false;
            page.querySelector('#chkPreservePitch').checked = config.PreservePitch !== false;
            page.querySelector('#chkEnablePitchShift').checked = config.EnablePitchShift !== false;
            page.querySelector('#chkShowBpmCalculator').checked = config.ShowBpmCalculator !== false;
            page.querySelector('#chkEnableKeyboardShortcuts').checked = config.EnableKeyboardShortcuts !== false;
            page.querySelector('#txtSpeedPresets').value = config.SpeedPresets || "0.50,0.60,0.70,0.75,0.80,0.85,0.90,0.95,1.00";
            page.querySelector('#txtMinTempo').value = config.MinTempo || 0.50;
            page.querySelector('#txtMaxTempo').value = config.MaxTempo || 1.50;
            page.querySelector('#txtStepSize').value = config.StepSize || 0.05;
            page.querySelector('#chkAutoInject').checked = config.AutoInjectWebClient !== false;
            loading.hide();
        }).catch(function () {
            loading.hide();
        });
    }

    function saveSettings(page) {
        loading.show();
        ApiClient.getPluginConfiguration(pluginId).then(function (config) {
            config.Enabled = page.querySelector('#chkEnabled').checked;
            config.PreservePitch = page.querySelector('#chkPreservePitch').checked;
            config.EnablePitchShift = page.querySelector('#chkEnablePitchShift').checked;
            config.ShowBpmCalculator = page.querySelector('#chkShowBpmCalculator').checked;
            config.EnableKeyboardShortcuts = page.querySelector('#chkEnableKeyboardShortcuts').checked;
            config.SpeedPresets = page.querySelector('#txtSpeedPresets').value;
            config.MinTempo = parseFloat(page.querySelector('#txtMinTempo').value) || 0.50;
            config.MaxTempo = parseFloat(page.querySelector('#txtMaxTempo').value) || 1.50;
            config.StepSize = parseFloat(page.querySelector('#txtStepSize').value) || 0.05;
            config.AutoInjectWebClient = page.querySelector('#chkAutoInject').checked;

            ApiClient.updatePluginConfiguration(pluginId, config).then(function (result) {
                loading.hide();
                Dashboard.processPluginConfigurationUpdateResult(result);
            }).catch(function () {
                loading.hide();
            });
        });
    }

    return function (view) {
        view.addEventListener('viewshow', function () {
            loadSettings(view);
        });

        view.querySelector('#bpmSettingsForm').addEventListener('submit', function (e) {
            e.preventDefault();
            saveSettings(view);
            return false;
        });
    };
});
