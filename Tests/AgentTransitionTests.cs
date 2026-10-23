using System.Windows;
using System.Windows.Controls;
using System.Windows.Media.Animation;
using VNotch.Controllers;
using VNotch.Models;
using VNotch.Presenters;
using Xunit;

namespace VNotch.Tests;
public sealed class AgentTransitionTests
{
    [Fact]
    public void AgentAndEveryExistingViewSharePresenterSelectionAndCollapseCleanup() => SharedStaTestRunner.RunAsync(() =>
    {
        var views = new Dictionary<NotchView, Grid>();
        foreach(var view in new[]{NotchView.Media,NotchView.Secondary,NotchView.Timer,NotchView.AudioMixer,NotchView.Camera,NotchView.Agents}) views[view]=new Grid();
        using var presenter=new NotchContentTransitionPresenter(new NotchContentViewRefs { ExpandedContent=views[NotchView.Media],
            SecondaryContent=views[NotchView.Secondary],TimerContent=views[NotchView.Timer],AudioContent=views[NotchView.AudioMixer],CameraContent=views[NotchView.Camera],AgentContent=views[NotchView.Agents] });
        var motion = new TransitionMotionConfig(new Duration(TimeSpan.Zero),new CubicEase(),60,true);
        long id=0; NotchView previous=NotchView.Compact;
        foreach(var target in new[]{NotchView.Agents,NotchView.Media,NotchView.Agents,NotchView.Timer,NotchView.Agents,NotchView.AudioMixer,NotchView.Agents,NotchView.Secondary,NotchView.Agents,NotchView.Camera})
        {
            TransitionExecutionResult? result=null;
            presenter.TransitionContent(new(++id,previous,target,NotchShapeState.Expanded,660,560,24,motion),value=>result=value);
            Assert.Equal(TransitionExecutionStatus.Completed,result!.Status);
            foreach(var (view,element) in views) { Assert.Equal(view==target?Visibility.Visible:Visibility.Collapsed,element.Visibility); Assert.Equal(view==target?1:0,element.Opacity); }
            previous=target;
        }
        presenter.SnapToView(NotchView.Compact);
        foreach(var element in views.Values) { Assert.Equal(Visibility.Collapsed,element.Visibility); Assert.Equal(0,element.Opacity); }
        return Task.CompletedTask;
    });
    [Fact]
    public void CoordinatorAcceptsAgentViewAndReturnsToMediaAndCompact()
    {
        var coordinator=new NotchTransitionCoordinator();
        try
        {
            foreach(var target in new[]{NotchView.Agents,NotchView.Media,NotchView.Agents,NotchView.Secondary,NotchView.Compact})
            {
                Assert.True(coordinator.RequestView(target,"AgentHarness"));
                Assert.Equal(target,coordinator.TargetView);coordinator.CompleteTransition(coordinator.ActiveTransitionId);
                Assert.Equal(target,coordinator.CurrentView);Assert.Equal(target!=NotchView.Compact,coordinator.IsExpanded);
            }
        }
        finally { coordinator.Dispose(); }
    }
}
