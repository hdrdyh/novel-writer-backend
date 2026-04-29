import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface Agent {
  id: string;
  name: string;
  role: string;
  enabled?: boolean;
}

// 简化版本 - 只显示图标
interface AgentStatusIconProps {
  currentStep: string;
  isRunning: boolean;
  stepCount?: number;
  totalSteps?: number;
}

export const AgentStatusIcon: React.FC<AgentStatusIconProps> = ({
  currentStep,
  isRunning,
  stepCount = 0,
  totalSteps = 6,
}) => {
  const [rotateAnim] = useState(() => new Animated.Value(0));
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (isRunning) {
      const animation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      animation.start();
      return () => animation.stop();
    } else {
      Animated.timing(rotateAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isRunning, rotateAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Pressable 
      style={styles.container}
      onPress={() => isRunning && setShowTooltip(prev => !prev)}
    >
      <Animated.View style={[styles.iconCircle, isRunning && { transform: [{ rotate: spin }] }]}>
        <Feather name={isRunning ? 'zap' : 'check'} size={18} color="#FFFFFF" />
      </Animated.View>
      
      {showTooltip && isRunning && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipStep}>{currentStep}</Text>
          <View style={styles.tooltipProgress}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.tooltipDot,
                  i < stepCount && styles.tooltipDotDone,
                  i === stepCount && styles.tooltipDotActive,
                ]}
              />
            ))}
          </View>
          <Text style={styles.tooltipHint}>点击关闭</Text>
        </View>
      )}
    </Pressable>
  );
};

// 完整版本 - 显示所有Agent
interface AgentStatusMonitorProps {
  agents: Agent[];
  currentAgentId: string | null;
  isRunning: boolean;
}

export const AgentStatusMonitor: React.FC<AgentStatusMonitorProps> = ({
  agents,
  currentAgentId,
  isRunning,
}) => {
  const [rotateAnim] = useState(() => new Animated.Value(0));
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    if (isRunning) {
      const animation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        })
      );
      animation.start();
      return () => animation.stop();
    } else {
      rotateAnim.setValue(0);
    }
  }, [isRunning, rotateAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const currentIndex = agents.findIndex(a => a.id === currentAgentId);
  const completedCount = currentIndex >= 0 ? currentIndex : agents.length;
  const totalCount = agents.length;
  const currentAgent = agents.find(a => a.id === currentAgentId);

  if (!isRunning && !currentAgentId) return null;

  return (
    <Pressable style={styles.container} onPress={() => setShowList(prev => !prev)}>
      <Animated.View style={[styles.iconCircle, isRunning && { transform: [{ rotate: spin }] }]}>
        <Feather name={isRunning ? 'zap' : 'check'} size={16} color="#FFFFFF" />
      </Animated.View>

      {showList && (
        <View style={styles.listContainer}>
          <Text style={styles.listTitle}>
            {currentAgent ? currentAgent.name : '完成'}
          </Text>
          <View style={styles.progressBar}>
            {agents.map((agent, idx) => (
              <View
                key={agent.id}
                style={[
                  styles.progressDot,
                  idx < currentIndex && styles.progressDotDone,
                  idx === currentIndex && styles.progressDotActive,
                ]}
              />
            ))}
          </View>
          <Text style={styles.progressText}>
            {completedCount}/{totalCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltip: {
    position: 'absolute',
    top: 44,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderRadius: 10,
    padding: 12,
    minWidth: 160,
    zIndex: 1000,
  },
  tooltipStep: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  tooltipProgress: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 6,
  },
  tooltipDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4B5563',
  },
  tooltipDotDone: {
    backgroundColor: '#10B981',
  },
  tooltipDotActive: {
    backgroundColor: '#3B82F6',
  },
  tooltipHint: {
    color: '#9CA3AF',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
  },
  // 完整版本样式
  listContainer: {
    position: 'absolute',
    top: 44,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderRadius: 12,
    padding: 14,
    minWidth: 180,
    zIndex: 1000,
  },
  listTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  progressBar: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  progressDot: {
    width: 16,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4B5563',
  },
  progressDotDone: {
    backgroundColor: '#10B981',
  },
  progressDotActive: {
    backgroundColor: '#3B82F6',
  },
  progressText: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
  },
});
