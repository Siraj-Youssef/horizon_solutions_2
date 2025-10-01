import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface TelaSplashProps {
  onStart?: () => void;
  navigation?: any; // Para navegação entre telas
}

const TelaSplash: React.FC<TelaSplashProps> = ({ onStart, navigation }) => {
  const [showButton, setShowButton] = useState<boolean>(false);

  // Animações
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.1)).current;
  const slideAnim = useRef(new Animated.Value(100)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(0.5)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    startAnimationSequence();
  }, []);

  const startAnimationSequence = () => {
    // Primeira fase: fade in do fundo com gradient reveal
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      // Segunda fase: animação complexa do logo
      animateLogoEntrance();
    });
  };

  const animateLogoEntrance = () => {
    // Rotação contínua para o ícone
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 20000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Animação principal do logo
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 1500,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 40,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 1200,
        easing: Easing.out(Easing.elastic(1)),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Terceira fase: efeito shimmer e pulso
      startShimmerEffect();
      setTimeout(() => {
        showStartButton();
      }, 800);
    });
  };

  const startShimmerEffect = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const showStartButton = () => {
    setShowButton(true);
    
    // Animação dramática de entrada do botão
    Animated.sequence([
      Animated.parallel([
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 1000,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(buttonScale, {
          toValue: 1,
          tension: 30,
          friction: 5,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      // Pulsação sutil contínua
      startContinuousPulse();
    });
  };

  const startContinuousPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  // Função de navegação para SystemScreen
  const navigateToSystemScreen = () => {
    if (navigation) {
      navigation.navigate('SystemScreen');
    }
  };

  const handleStartPress = () => {
    // Animação complexa de saída
    Animated.parallel([
      Animated.timing(buttonOpacity, {
        toValue: 0,
        duration: 400,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 0,
        duration: 600,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.3,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start(() => {
      navigateToSystemScreen();
      if (onStart) {
        onStart();
      }
    });
  };

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const shimmerInterpolate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, width + 200],
  });

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={['#000000', '#232227', '#24314e', '#273445', '#3e5954', '#61928a', '#fcfdfd']}
          locations={[0, 0.15, 0.3, 0.45, 0.6, 0.8, 1]}
          style={styles.gradientContainer}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Elementos decorativos orgânicos */}
          <View style={styles.backgroundElements}>
            <Animated.View 
              style={[
                styles.floatingElement, 
                styles.element1,
                { opacity: logoOpacity }
              ]} 
            />
            <Animated.View 
              style={[
                styles.floatingElement, 
                styles.element2,
                { opacity: logoOpacity }
              ]} 
            />
            <Animated.View 
              style={[
                styles.floatingElement, 
                styles.element3,
                { opacity: logoOpacity }
              ]} 
            />
          </View>

          {/* Conteúdo principal */}
          <Animated.View
            style={[
              styles.content,
              {
                opacity: logoOpacity,
                transform: [
                  { scale: scaleAnim },
                  { translateY: slideAnim }
                ],
              },
            ]}
          >
            {/* Logo/Ícone principal com rotação */}
            <View style={styles.logoContainer}>
              <Animated.View 
                style={[
                  styles.logoIcon,
                  { transform: [{ rotate: rotateInterpolate }] }
                ]}
              >
                <Text style={styles.logoText}>🔭</Text>
                
                {/* Efeito shimmer */}
                <Animated.View
                  style={[
                    styles.shimmerEffect,
                    {
                      transform: [{ translateX: shimmerInterpolate }],
                    },
                  ]}
                />
              </Animated.View>
            </View>

            {/* Título principal da empresa */}
            <Text style={styles.title}>HORIZON SOLUTIONS</Text>
            
            {/* Linha decorativa animada */}
            <Animated.View
              style={[
                styles.decorativeLine,
                {
                  opacity: logoOpacity,
                  scaleX: logoOpacity,
                },
              ]}
            />

            {/* Subtítulo */}
            <Text style={styles.subtitle}>Expandindo horizontes</Text>

            {/* Partículas flutuantes */}
            <View style={styles.particlesContainer}>
              {[...Array(6)].map((_, index) => (
                <Animated.View
                  key={index}
                  style={[
                    styles.particle,
                    {
                      opacity: logoOpacity,
                      transform: [
                        {
                          translateY: slideAnim.interpolate({
                            inputRange: [0, 100],
                            outputRange: [0, (index + 1) * 20],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              ))}
            </View>
          </Animated.View>

          {/* Botão para próxima tela */}
          {showButton && (
            <Animated.View
              style={[
                styles.buttonContainer,
                {
                  opacity: buttonOpacity,
                  transform: [
                    { scale: buttonScale },
                    { scale: pulseAnim }
                  ],
                },
              ]}
            >
              <TouchableOpacity
                style={styles.startButton}
                onPress={handleStartPress}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={['#61928a', '#3e5954', '#273445']}
                  style={styles.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.startButtonText}>INICIAR JORNADA</Text>
                  <Text style={styles.buttonArrow}>→</Text>
                </LinearGradient>
                
                {/* Efeito de borda brilhante */}
                <View style={styles.buttonGlow} />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Footer elegante */}
          <Animated.View 
            style={[
              styles.footer,
              { opacity: buttonOpacity }
            ]}
          >
            <View style={styles.footerLine} />
            <Text style={styles.footerText}>© 2025 Horizon Solutions</Text>
            <Text style={styles.footerSubtext}>Inovação • Tecnologia • Excelência</Text>
          </Animated.View>
        </LinearGradient>
      </Animated.View>
    </>
  );
};

export default TelaSplash;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundElements: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  floatingElement: {
    position: 'absolute',
    borderRadius: 1000,
    backgroundColor: 'rgba(252, 253, 253, 0.1)',
  },
  element1: {
    width: 180,
    height: 180,
    top: height * 0.1,
    right: -90,
    backgroundColor: 'rgba(97, 146, 138, 0.15)',
  },
  element2: {
    width: 120,
    height: 120,
    bottom: height * 0.2,
    left: -60,
    backgroundColor: 'rgba(39, 52, 69, 0.2)',
  },
  element3: {
    width: 80,
    height: 80,
    top: height * 0.4,
    right: 20,
    backgroundColor: 'rgba(252, 253, 253, 0.08)',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  logoContainer: {
    marginBottom: 30,
  },
  logoIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(97, 146, 138, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(252, 253, 253, 0.3)',
    shadowColor: '#61928a',
    shadowOffset: {
      width: 0,
      height: 15,
    },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 15,
    overflow: 'hidden',
  },
  logoText: {
    fontSize: 45,
    color: '#fcfdfd',
    textShadowColor: '#61928a',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  shimmerEffect: {
    position: 'absolute',
    top: 0,
    width: 30,
    height: '100%',
    backgroundColor: 'rgba(252, 253, 253, 0.3)',
    transform: [{ skewX: '-20deg' }],
  },
  title: {
    fontSize: 28,
    fontWeight: '200',
    color: '#fcfdfd',
    marginBottom: 15,
    textAlign: 'center',
    letterSpacing: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 15,
  },
  decorativeLine: {
    width: 250,
    height: 1,
    backgroundColor: '#61928a',
    marginTop: 5,
    marginBottom: 25,
    shadowColor: '#61928a',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(252, 253, 253, 0.7)',
    textAlign: 'center',
    marginBottom: 40,
    fontWeight: '300',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    lineHeight: 18,
  },
  particlesContainer: {
    position: 'absolute',
    top: -50,
    left: -50,
    right: -50,
    bottom: -50,
    pointerEvents: 'none',
  },
  particle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#61928a',
    shadowColor: '#61928a',
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 140,
    alignSelf: 'center',
  },
  startButton: {
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#61928a',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 10,
  },
  buttonGradient: {
    paddingHorizontal: 50,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 220,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fcfdfd',
    marginRight: 12,
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  buttonArrow: {
    fontSize: 22,
    color: '#fcfdfd',
    fontWeight: '300',
  },
  buttonGlow: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: 'rgba(252, 253, 253, 0.2)',
    shadowColor: '#fcfdfd',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  footer: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
  },
  footerLine: {
    width: 60,
    height: 1,
    backgroundColor: 'rgba(252, 253, 253, 0.3)',
    marginBottom: 15,
  },
  footerText: {
    fontSize: 11,
    color: 'rgba(252, 253, 253, 0.6)',
    fontWeight: '400',
    letterSpacing: 1,
    marginBottom: 5,
  },
  footerSubtext: {
    fontSize: 9,
    color: 'rgba(252, 253, 253, 0.4)',
    fontWeight: '300',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});