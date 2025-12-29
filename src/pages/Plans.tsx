import { useState } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, HardDrive, Zap, MessageCircle, Calendar, Clock, Gift } from 'lucide-react';
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

// Free trial plan
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
  const { profile } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<typeof monthlyPlans[0] | null>(null);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [customPlanDialogOpen, setCustomPlanDialogOpen] = useState(false);

  const handleSelectPlan = (plan: typeof monthlyPlans[0]) => {
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

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto">
          <Badge className="mb-4 bg-primary/20 text-primary border-primary/30">
            <Crown className="w-3 h-3 mr-1" />
            Premium Plans
          </Badge>
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Upgrade Your Storage
          </h1>
          <p className="text-muted-foreground">
            Choose the perfect plan for your needs. All plans include premium features and priority support.
          </p>
        </div>

        {/* Free Trial */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="relative border-dashed border-2 border-green-500/30 bg-green-500/5">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-green-500 text-white">
                <Gift className="w-3 h-3 mr-1" />
                7-Day Free Trial
              </Badge>
            </div>
            <CardContent className="py-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="text-center md:text-left">
                  <h3 className="text-xl font-semibold text-foreground mb-2">Start Your Free Trial</h3>
                  <p className="text-muted-foreground max-w-md">
                    Try FileCloud free for 7 days with 5GB storage, 50GB bandwidth, and 10 active links. No credit card required.
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <span className="text-3xl font-bold text-foreground">₹0</span>
                    <span className="text-muted-foreground text-sm block">for 7 days</span>
                  </div>
                  <Button onClick={() => handleSelectPlan(freePlan)} variant="outline" className="border-green-500/50 text-green-500 hover:bg-green-500/10">
                    Start Free Trial
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Monthly Plans */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Monthly Plans</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {monthlyPlans.map((plan, index) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className={`relative h-full ${plan.popular ? 'border-primary shadow-lg shadow-primary/20' : ''}`}>
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pb-2">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
                      <HardDrive className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <CardDescription>per month</CardDescription>
                  </CardHeader>
                  <CardContent className="text-center">
                    <div className="mb-4">
                      <span className="text-3xl font-bold text-foreground">₹{plan.price}</span>
                      <span className="text-muted-foreground">/mo</span>
                    </div>
                    <ul className="space-y-2 text-sm text-left">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        {plan.storage} GB Storage
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        {plan.bandwidth} GB Bandwidth
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        {plan.links} Active Links
                      </li>
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      className="w-full" 
                      variant={plan.popular ? 'default' : 'outline'}
                      onClick={() => handleSelectPlan(plan)}
                    >
                      Get Started
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Yearly Plans */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-500" />
            <h2 className="text-xl font-semibold text-foreground">Yearly Plans</h2>
            <Badge variant="outline" className="text-amber-500 border-amber-500/30">Save 2 Months</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {yearlyPlans.map((plan, index) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 + 0.4 }}
              >
                <Card className={`relative h-full ${plan.popular ? 'border-amber-500 shadow-lg shadow-amber-500/20' : ''}`}>
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-amber-500 text-white">Best Value</Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pb-2">
                    <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-2">
                      <Crown className="w-6 h-6 text-amber-500" />
                    </div>
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <CardDescription>per year</CardDescription>
                  </CardHeader>
                  <CardContent className="text-center">
                    <div className="mb-4">
                      <span className="text-3xl font-bold text-foreground">₹{plan.price}</span>
                      <span className="text-muted-foreground">/year</span>
                    </div>
                    <ul className="space-y-2 text-sm text-left">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        {plan.storage} GB Storage
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        {plan.bandwidth} GB Bandwidth/mo
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        {plan.links} Active Links
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        2 Months Free
                      </li>
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      className="w-full" 
                      variant={plan.popular ? 'default' : 'outline'}
                      onClick={() => handleSelectPlan(plan)}
                    >
                      Get Yearly
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Custom Plan */}
        <Card className="border-dashed border-2">
          <CardContent className="py-8">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">Need a Custom Plan?</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Need more storage, higher bandwidth, or special requirements? Contact us for a custom plan tailored to your needs.
              </p>
              <Button onClick={() => setCustomPlanDialogOpen(true)} variant="outline" className="gap-2">
                <MessageCircle className="w-4 h-4" />
                Contact for Custom Plan
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* All Features */}
        <Card>
          <CardHeader>
            <CardTitle>All Premium Features</CardTitle>
            <CardDescription>Every plan includes these powerful features</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Check className="w-3 h-3 text-green-500" />
                  </div>
                  <span className="text-sm text-foreground">{feature}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Purchase Dialog */}
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Purchase {selectedPlan?.name} Plan</DialogTitle>
            <DialogDescription>
              Contact us to complete your purchase for ₹{selectedPlan?.price} ({selectedPlan?.period})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="p-4 rounded-lg bg-muted">
              <h4 className="font-medium mb-2">Plan Details:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
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
              className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-[#0088cc] flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-foreground">Telegram</p>
                <p className="text-sm text-muted-foreground">@kartoos0070</p>
              </div>
            </a>
            <a
              href="https://instagram.com/theriturajprince"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#833ab4] via-[#fd1d1d] to-[#fcb045] flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </div>
              <div>
                <p className="font-medium text-foreground">Instagram</p>
                <p className="text-sm text-muted-foreground">@theriturajprince</p>
              </div>
            </a>
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom Plan Dialog */}
      <Dialog open={customPlanDialogOpen} onOpenChange={setCustomPlanDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Custom Plan Request</DialogTitle>
            <DialogDescription>
              Contact us to discuss your custom requirements
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Tell us about your storage, bandwidth, and feature requirements. We'll create a custom plan just for you.
            </p>
            <a
              href="https://t.me/kartoos0070"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-[#0088cc] flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-foreground">Telegram</p>
                <p className="text-sm text-muted-foreground">@kartoos0070</p>
              </div>
            </a>
            <a
              href="https://instagram.com/theriturajprince"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#833ab4] via-[#fd1d1d] to-[#fcb045] flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </div>
              <div>
                <p className="font-medium text-foreground">Instagram</p>
                <p className="text-sm text-muted-foreground">@theriturajprince</p>
              </div>
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Plans;
