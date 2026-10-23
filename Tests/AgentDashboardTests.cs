using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Controls.Primitives;
using VNotch.Controls.Agents;
using VNotch.Services.Agents;
using Xunit;

namespace VNotch.Tests;
public sealed class AgentDashboardTests
{
    private static T Part<T>(AgentDashboard view, string name) => (T)view.FindName(name);
    private static AgentSnapshot Sample(DateTimeOffset now) => new([
        new("Codex", [new("one",now,"fixture",123456,1234,100000)], [new("Codex","Build local transfer","V-Notch","Recent",now)],
            new("Live account",[new("5 hours",27,now.AddHours(2).AddMinutes(16),now,"Account"),new("Weekly",54,now.AddDays(3).AddHours(4),now,"Account")],now),true),
        new("Claude Code", [new("two",now,"fixture",60000,8000,40000)], [new("Claude Code","Review notch layout","V-Notch","Working",now)],
            new("Live account",[new("5 hours",38,now.AddHours(1).AddMinutes(42),now,"Account"),new("Weekly",19,now.AddDays(4).AddHours(8),now,"Account")],now),false)
    ],now);
    [Fact]
    public void MissingAndExpiredQuotasRenderExplicitlyWithoutZeroPercentClaims() => SharedStaTestRunner.RunAsync(() =>
    {
        using var view = new AgentDashboard(); var now = DateTimeOffset.Now;
        view.Present(new([new("Codex",[],[],new("CLI not found",[],now),false),new("Claude Code",[],[],new("Not signed in",[],now),false)],now));
        Assert.Equal(Visibility.Visible, Part<TextBlock>(view,"EmptyActivity").Visibility);
        Assert.Equal(2, Part<ItemsControl>(view,"Providers").Items.Count);
        Assert.Contains("Reset due",AgentDashboard.ResetText(new("5 hours",10,now.AddSeconds(-1),now,"Account"),now));
        Assert.Contains("snapshot",AgentDashboard.ResetText(new("5 hours",10,now.AddHours(1),now.AddMinutes(-8),"Log snapshot"),now));
        return Task.CompletedTask;
    });
    [Fact]
    public void DetailsShowActualBreakdownsAndTheDisclosureSurvivesPolling() => SharedStaTestRunner.RunAsync(() =>
    {
        using var view = new AgentDashboard();
        var sample = Sample(DateTimeOffset.Now); view.Present(sample);
        Assert.Equal(2, Part<ItemsControl>(view, "Breakdowns").Items.Count);
        Assert.Equal(Visibility.Visible, Part<StackPanel>(view, "UsageDetails").Visibility);
        object codex = Part<ItemsControl>(view, "Providers").Items[0];
        Assert.Equal("123.5K", codex.GetType().GetProperty("Input")!.GetValue(codex));
        Assert.Equal("1.2K", codex.GetType().GetProperty("Output")!.GetValue(codex));
        Assert.Contains("123,456", codex.GetType().GetProperty("ExactInput")!.GetValue(codex)!.ToString());
        Part<Button>(view, "DetailsButton").RaiseEvent(new RoutedEventArgs(ButtonBase.ClickEvent));
        view.Present(sample);
        Assert.Equal(Visibility.Collapsed, Part<StackPanel>(view, "UsageDetails").Visibility);
        Assert.Equal("More detail", Part<Button>(view, "DetailsButton").Content);
        return Task.CompletedTask;
    });
    [Theory]
    [InlineData(7)][InlineData(30)]
    public void PeriodSelectionRebuildsTheActualActivityIntervals(int days) => SharedStaTestRunner.RunAsync(() =>
    {
        using var view = new AgentDashboard();
        Part<Button>(view, days == 7 ? "Week" : "Month").RaiseEvent(new RoutedEventArgs(ButtonBase.ClickEvent));
        view.Present(Sample(DateTimeOffset.Now));
        object first = Part<ItemsControl>(view, "Breakdowns").Items[0];
        Assert.Equal(days, first.GetType().GetProperty("BucketCount")!.GetValue(first));
        return Task.CompletedTask;
    });
    [Theory]
    [InlineData(622,496)][InlineData(382,300)]
    public void NativeCardsFitNarrowAndFullNotchSizes(double width,double height) => SharedStaTestRunner.RunAsync(() =>
    {
        using var view = new AgentDashboard { FontFamily = new FontFamily($"pack://application:,,,/{typeof(AgentDashboard).Assembly.GetName().Name};component/Fonts/#SF Pro Display, Segoe UI") };
        view.Present(Sample(DateTimeOffset.Now)); view.Measure(new Size(width,height)); view.Arrange(new Rect(0,0,width,height)); view.UpdateLayout();
        foreach (string name in new[]{"DetailsButton","RefreshLimits","Today","Week","Month","Providers","AgentScroll"})
        {
            var element = Part<FrameworkElement>(view,name); var bounds = element.TransformToAncestor(view).TransformBounds(new Rect(element.RenderSize));
            Assert.True(bounds.Left>=0 && bounds.Right<=width+0.5 && bounds.Top>=0 && (name=="Providers" || bounds.Bottom<=height+0.5),name+" must fit the notch viewport");
        }
        Assert.Equal("1 working",Part<TextBlock>(view,"ActivityCount").Text);
        Assert.True(Part<ScrollViewer>(view,"AgentScroll").ScrollableWidth<1);
        if(height<400) Assert.True(Part<ScrollViewer>(view,"AgentScroll").ScrollableHeight>0);
        if(width>600)
        {
            string folder=Path.GetFullPath(Path.Combine(AppContext.BaseDirectory,"../../../../../.test-output"));Directory.CreateDirectory(folder);
            void Save(string name)
            {
                // Render the arranged viewport directly. VisualBrush auto-layout can
                // otherwise remeasure an unattached test control to its full extent.
                var content = new RenderTargetBitmap((int)width,(int)height,96,96,PixelFormats.Pbgra32); content.Render(view);
                var visual = new DrawingVisual(); using(var context=visual.RenderOpen()) { context.DrawRectangle(Brushes.Black,null,new Rect(0,0,width+48,height+64)); context.DrawImage(content,new Rect(24,44,width,height)); }
                var image = new RenderTargetBitmap((int)width+48,(int)height+64,96,96,PixelFormats.Pbgra32); image.Render(visual);
                var encoder=new PngBitmapEncoder();encoder.Frames.Add(BitmapFrame.Create(image));using var file=File.Create(Path.Combine(folder,name));encoder.Save(file);
            }
            Save("agent-dashboard.png");
            Part<ScrollViewer>(view,"AgentScroll").ScrollToVerticalOffset(Part<ItemsControl>(view,"Providers").ActualHeight+14); view.UpdateLayout();
            Assert.True(Part<ScrollViewer>(view,"AgentScroll").VerticalOffset > 0, "Usage details must be reachable by scrolling");
            Save("agent-breakdown.png");
        }
        return Task.CompletedTask;
    });
}
