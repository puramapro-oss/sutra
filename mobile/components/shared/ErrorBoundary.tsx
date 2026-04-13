import { Component, type ReactNode } from "react";
import { View, Text, TouchableOpacity } from "react-native";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, retryCount: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  handleRetry = () => {
    if (this.state.retryCount < 3) {
      this.setState((prev) => ({
        hasError: false,
        error: null,
        retryCount: prev.retryCount + 1,
      }));
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <View className="flex-1 bg-background items-center justify-center p-8">
          <Text className="text-4xl mb-4">⚠️</Text>
          <Text className="text-white text-xl font-sans-bold text-center mb-2">
            Oups, une erreur est survenue
          </Text>
          <Text className="text-white/50 text-center font-sans mb-6">
            {this.state.error?.message || "Erreur inattendue"}
          </Text>
          {this.state.retryCount < 3 && (
            <TouchableOpacity
              className="bg-primary px-6 py-3 rounded-xl"
              onPress={this.handleRetry}
            >
              <Text className="text-white font-sans-bold">Réessayer</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}
