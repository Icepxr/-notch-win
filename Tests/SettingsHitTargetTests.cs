using System.Reflection;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using Microsoft.Extensions.DependencyInjection;
using VNotch.Controllers;
using VNotch.Models;
using VNotch.Services;
using VNotch.Tests.Fakes;
using Xunit;

namespace VNotch.Tests;

[Collection("Localization")]
public sealed class SettingsHitTargetTests
{
    private const BindingFlags Private = BindingFlags.Instance | BindingFlags.NonPublic;

    [Theory]
    [InlineData(NotchEdge.Top)]
    [InlineData(NotchEdge.Left)]
    [InlineData(NotchEdge.Right)]
    public void GearReceivesThePointerAndOpensSettings(NotchEdge edge) => SharedStaTestRunner.RunAsync(async ct =>
    {
        await using var fixture = new GreetingAcceptanceTests.MainWindowFixture("en", false,
            s => { s.EnableLocalOnlyMode = true; s.AutoCheckUpdates = false;
                s.EnableEdgeDocking = true; s.DockEdge = edge; s.Width = 230;
                s.EnableDynamicIslandMode = true; s.DynamicIslandWidth = 240; },
            services => services.AddSingleton<IMediaDetectionService>(new FakeMediaDetectionService()));
        var window = fixture.Window;
        window.Show();
        var coordinator = (NotchTransitionCoordinator)typeof(MainWindow).GetField("_transitionCoordinator", Private)!.GetValue(window)!;
        await WpfFrameWaiter.UntilAsync(() => !Animating(window), "startup settles", ct);
        coordinator.RequestView(NotchView.Media, "gear-hit-target-test");
        await WpfFrameWaiter.UntilAsync(() => !Animating(window) && coordinator.CurrentView == NotchView.Media, "media settles", ct);
        window.UpdateLayout();
        var gear = window.SettingsButton;
        var point = gear.TranslatePoint(new Point(gear.ActualWidth / 2, gear.ActualHeight / 2), window);
        var hit = window.InputHitTest(point) as DependencyObject;
        Assert.True(IsInside(hit, gear), $"{edge}: pointer hits {hit?.GetType().Name} instead of the gear");
        try
        {
            // Use the actual hit target's routed input, rather than calling the
            // settings handler directly and missing a transparent overlay.
            ((UIElement)hit!).RaiseEvent(new MouseButtonEventArgs(Mouse.PrimaryDevice, Environment.TickCount, MouseButton.Left)
            { RoutedEvent = Mouse.MouseDownEvent });
            await WpfFrameWaiter.UntilAsync(() => typeof(MainWindow).GetField("_activeSettingsWindow", Private)!.GetValue(window) is Window { IsVisible: true }, "settings opens", ct);
        }
        finally
        {
            (typeof(MainWindow).GetField("_activeSettingsWindow", Private)!.GetValue(window) as Window)?.Close();
        }
    });

    private static bool IsInside(DependencyObject? hit, DependencyObject owner)
    {
        while (hit != null)
        {
            if (ReferenceEquals(hit, owner)) return true;
            hit = VisualTreeHelper.GetParent(hit);
        }
        return false;
    }

    private static bool Animating(MainWindow w) => (bool)typeof(MainWindow).GetProperty("_isAnimating", Private)!.GetValue(w)!;
}
