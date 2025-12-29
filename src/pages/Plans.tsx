import { useState } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { PageTransition } from '@/components/ui/PageTransition';
import { GlassCard } from '@/components/ios/GlassCard';
import { IosSegmentedControl } from '@/components/ios';
import { lightHaptic } from '@/lib/haptics';
import { Check, Crown, HardDrive, Zap, MessageCircle, Gift } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const monthlyPlans = [
  {
    id: 'monthly-100',
    name: '100 GB',
    storage: 100,
    bandwidth: 500,
    links: 50,
    price: 99,
    period: '1 month',
    popular: false,
  },
  {
    id: 'monthly-200',
    name: '200 GB',
    storage: 200,
    bandwidth: 1000,
    links: 100,
    price: 179,
    period: '1 month',
    popular: true,
  },
  {
    id: 'monthly-400',
    name: '400 GB',
    storage: 400,
    bandwidth: 2000,
    links: 200,
    price: 299,
    period: '1 month',
    popular: false,
  },
  {
    id: 'monthly-1tb',
    name: '1 TB',
    storage: 1000,
    bandwidth: 5000,
    links: 500,
    price: 499,
    period: '1 month',
    popular: false,
  },
];

const yearlyPlans = [
  {
    id: 'yearly-100',
    name: '100 GB',
    storage: 100,
    bandwidth: 500,
    links: 50,
    price: 999,
    period: 'yearly',
    popular: false,
  },
  {
    id: 'yearly-200',
    name: '200 GB',
    storage: 200,
    bandwidth: 1000,
    links: 100,
    price: 1799,
    period: 'yearly',
    popular: true,
  },
  {
    id: 'yearly-400',
    name: '400 GB',
    storage: 400,
    bandwidth: 2000,
    links: 200,
    price: 2999,
    period: 'yearly',
    popular: false,
  },
  {
    id: 'yearly-1tb',
    name: '1 TB',
    storage: 1000,
    bandwidth: 5000,
    links: 500,
    price: 4999,
    period: 'yearly',
    popular: false,
  },
];

const freePlan = {
  id: 'free-trial',
  name: 'Free Trial',
  storage: 5,
  bandwidth: 50,
  links: 10,
  price: 0,
  period: '7 days',
  popular: false,
};

const Plans = () => {
  const [selectedPlan, setSelectedPlan] = useState<typeof monthlyPlans[0] | null>(null);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [customPlanDialogOpen, setCustomPlanDialogOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState('monthly');

  const handleSelectPlan = (plan: typeof monthlyPlans[0]) => {
    lightHaptic();
    setSelectedPlan(plan);
    setContactDialogOpen(true);
  };

  const features = [
    'Secure file storage',
    'Fast CDN delivery',
    'Share links with password protection',
    'Download analytics',
    'Priority support',
    'No ads',
  ];

  const currentPlans = billingCycle === 'monthly' ? monthlyPlans : yearlyPlans;

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-2xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 mb-4">
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-amber-400">Premium Plans</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-4 tracking-tight">
              Upgrade Your Storage
            </h1>
            <p className="text-white/50">
              Choose the perfect plan for your needs. All plans include premium features and priority support.
            </p>
          </motion.div>

          {/* Free Trial */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <GlassCard className="relative border-2 border-dashed border-emerald-500/30 bg-emerald-500/5">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 text-white text-sm font-medium">
                  <Gift className="w-3.5 h-3.5" />
                  7-Day Free Trial
                </div>
              </div>
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-4">
                <div className="text-center md:text-left">
                  <h3 className="text-xl font-semibold text-white mb-2">Start Your Free Trial</h3>
                  <p className="text-white/50 max-w-md">
                    Try FileCloud free for 7 days with 5GB storage, 50GB bandwidth, and 10 active links. No credit card required.
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <span className="text-3xl font-bold text-white">₹0</span>
                    <span className="text-white/50 text-sm block">for 7 days</span>
                  </div>
                  <button 
                    onClick={() => handleSelectPlan(freePlan)} 
                    className="ios-button-secondary border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
                  >
                    Start Free Trial
                  </button>
                </div>
              </div>
            </GlassCard>
          </motion.div>

          {/* Billing Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex justify-center"
          >
            <IosSegmentedControl
              segments={[
                { value: 'monthly', label: 'Monthly' },
                { value: 'yearly', label: 'Yearly (Save 2 mo)' },
              ]}
              value={billingCycle}
              onChange={setBillingCycle}
            />
          </motion.div>

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {currentPlans.map((plan, index) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
              >
                <GlassCard 
                  className={`relative h-full ${plan.popular ? 'border-2 border-teal-500/50 shadow-lg shadow-teal-500/20' : ''}`}
                  interactive
                  onClick={() => handleSelectPlan(plan)}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <div className="px-3 py-1 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-xs font-medium">
                        {billingCycle === 'yearly' ? 'Best Value' : 'Most Popular'}
                      </div>
                    </div>
                  )}
                  
                  <div className="text-center pb-2 pt-2">
                    <div className={`w-12 h-12 rounded-xl ${plan.popular ? 'bg-gradient-to-br from-teal-500 to-cyan-600' : 'bg-white/[0.08]'} flex items-center justify-center mx-auto mb-3`}>
                      {billingCycle === 'yearly' ? (
                        <Crown className={`w-6 h-6 ${plan.popular ? 'text-white' : 'text-amber-400'}`} />
                      ) : (
                        <HardDrive className={`w-6 h-6 ${plan.popular ? 'text-white' : 'text-teal-400'}`} />
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                    <p className="text-sm text-white/40">{billingCycle === 'yearly' ? 'per year' : 'per month'}</p>
                  </div>
                  
                  <div className="text-center my-4">
                    <span className="text-3xl font-bold text-white">₹{plan.price}</span>
                    <span className="text-white/40">/{billingCycle === 'yearly' ? 'yr' : 'mo'}</span>
                  </div>
                  
                  <ul className="space-y-3 text-sm mb-6">
                    <li className="flex items-center gap-2 text-white/70">
                      <Check className="w-4 h-4 text-emerald-400" />
                      {plan.storage} GB Storage
                    </li>
                    <li className="flex items-center gap-2 text-white/70">
                      <Check className="w-4 h-4 text-emerald-400" />
                      {plan.bandwidth} GB Bandwidth{billingCycle === 'yearly' ? '/mo' : ''}
                    </li>
                    <li className="flex items-center gap-2 text-white/70">
                      <Check className="w-4 h-4 text-emerald-400" />
                      {plan.links} Active Links
                    </li>
                    {billingCycle === 'yearly' && (
                      <li className="flex items-center gap-2 text-white/70">
                        <Check className="w-4 h-4 text-emerald-400" />
                        2 Months Free
                      </li>
                    )}
                  </ul>
                  
                  <button 
                    className={`w-full ${plan.popular ? 'ios-button-primary' : 'ios-button-secondary'}`}
                  >
                    Get Started
                  </button>
                </GlassCard>
              </motion.div>
            ))}
          </div>

          {/* Custom Plan */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <GlassCard className="border-2 border-dashed border-white/10">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto">
                  <Zap className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white">Need a Custom Plan?</h3>
                <p className="text-white/50 max-w-md mx-auto">
                  Need more storage, higher bandwidth, or special requirements? Contact us for a custom plan tailored to your needs.
                </p>
                <button 
                  onClick={() => {
                    lightHaptic();
                    setCustomPlanDialogOpen(true);
                  }} 
                  className="ios-button-secondary gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  Contact for Custom Plan
                </button>
              </div>
            </GlassCard>
          </motion.div>

          {/* All Features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <GlassCard>
              <h3 className="text-lg font-semibold text-white mb-2">All Premium Features</h3>
              <p className="text-sm text-white/50 mb-6">Every plan includes these powerful features</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <span className="text-sm text-white/70">{feature}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </PageTransition>

      {/* Purchase Dialog */}
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="sm:max-w-md ios-glass border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Purchase {selectedPlan?.name} Plan</DialogTitle>
            <DialogDescription className="text-white/50">
              Contact us to complete your purchase for ₹{selectedPlan?.price} ({selectedPlan?.period})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
              <h4 className="font-medium mb-2 text-white">Plan Details:</h4>
              <ul className="text-sm space-y-1 text-white/50">
                <li>• Storage: {selectedPlan?.storage} GB</li>
                <li>• Bandwidth: {selectedPlan?.bandwidth} GB</li>
                <li>• Active Links: {selectedPlan?.links}</li>
                <li>• Duration: {selectedPlan?.period === 'yearly' ? '1 Year' : selectedPlan?.period === '7 days' ? '7 Days (Trial)' : '1 Month'}</li>
              </ul>
            </div>
            <a
              href="https://t.me/kartoos0070"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => lightHaptic()}
              className="flex items-center gap-3 p-4 rounded-xl ios-glass hover:bg-white/[0.06] transition-colors ios-press"
            >
              <div className="w-10 h-10 rounded-full bg-[#0088cc] flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-white">Telegram</p>
                <p className="text-sm text-white/50">@kartoos0070</p>
              </div>
            </a>
            <a
              href="https://instagram.com/theriturajprince"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => lightHaptic()}
              className="flex items-center gap-3 p-4 rounded-xl ios-glass hover:bg-white/[0.06] transition-colors ios-press"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#833ab4] via-[#fd1d1d] to-[#fcb045] flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </div>
              <div>
                <p className="font-medium text-white">Instagram</p>
                <p className="text-sm text-white/50">@theriturajprince</p>
              </div>
            </a>
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom Plan Dialog */}
      <Dialog open={customPlanDialogOpen} onOpenChange={setCustomPlanDialogOpen}>
        <DialogContent className="sm:max-w-md ios-glass border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Custom Plan Request</DialogTitle>
            <DialogDescription className="text-white/50">
              Contact us to discuss your custom requirements
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-white/50">
              Tell us about your storage, bandwidth, and feature requirements. We'll create a custom plan just for you.
            </p>
            <a
              href="https://t.me/kartoos0070"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => lightHaptic()}
              className="flex items-center gap-3 p-4 rounded-xl ios-glass hover:bg-white/[0.06] transition-colors ios-press"
            >
              <div className="w-10 h-10 rounded-full bg-[#0088cc] flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-white">Telegram</p>
                <p className="text-sm text-white/50">@kartoos0070</p>
              </div>
            </a>
            <a
              href="https://instagram.com/theriturajprince"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => lightHaptic()}
              className="flex items-center gap-3 p-4 rounded-xl ios-glass hover:bg-white/[0.06] transition-colors ios-press"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#833ab4] via-[#fd1d1d] to-[#fcb045] flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </div>
              <div>
                <p className="font-medium text-white">Instagram</p>
                <p className="text-sm text-white/50">@theriturajprince</p>
              </div>
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Plans;
